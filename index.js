var CachingWriter = require('broccoli-caching-writer');
var Promise = require('bluebird');

var glob = Promise.promisify(require('glob'));
var fs = Promise.promisifyAll(require('fs'));
var path = require('path');
var less = require('less');
var mkdirp = require('mkdirp');
var defaults = require('lodash/object/defaults');

var debug = require('debug')('broccoli-less-final');

function Less(sourceTrees, options) {
    this.lessOptions = options.lessOptions || {};

    CachingWriter.apply(this, [sourceTrees, options]);

    if (this.inputFile) {
        this.files = [this.inputFile];
    }

}

function LessError(err, options) {
    this.name = 'LessError';
    this.lessError = err;
    this.lessOptions = options;
}

LessError.prototype = new Error();

Less.prototype = Object.create(CachingWriter.prototype);

Less.prototype.updateCache = function(srcDir, destDir) {

    var files = Promise.resolve(this.files);

    return files.reduce(function(result, pattern) {

        return glob(pattern,
                    {   cwd: srcDir[0]
                    }).then(function(matches) {
        debug('globbing with %s resulted in: %s', pattern, matches);
        return result.concat(matches);
                    });

    }, []).map(function(file) {
        var fullPath = path.join(srcDir[0], file);
        return fs.readFileAsync(fullPath, 'utf8')
                    .then(function(contents) {
                        return {    filename: file,
                                    contents: contents
                        };
                    });
    }).map(function(pathAndContents) {
        var paths = srcDir;
        var fileDir = path.dirname(pathAndContents.filename);
        paths.push(path.join(srcDir[0], fileDir));

        var lessOptions =
            {   filename: pathAndContents.filename,
                paths: paths
            };

        lessOptions =
            defaults({}, lessOptions, this.lessOptions);

        debug('using less options: %o', lessOptions);

        return less.render(pathAndContents.contents, lessOptions)
                    .then(function(output) {
                        debug('less output: %o', output);
                        return {    filename: pathAndContents.filename,
                                    output: output
                        };
                    }).catch(function(err) {
                        throw new LessError(err, lessOptions);
                    });

    }.bind(this)).reduce(function(result, renderResult) {

        var destPath = path.join(destDir, renderResult.filename.replace('.less', '.css'));
        var basePath = path.dirname(destPath);
        mkdirp.sync(basePath);
        var writeSourceMap;

        if (renderResult.output.map) {
            var sourceMapUrl = this.lessOptions.sourceMap.sourceMapURL || destPath;
            var sourceMapDestPath = sourceMapUrl + '.map';
            writeSourceMap = function() {
                debug('writing sourcemap to: %s', sourceMapDestPath);
                return fs.writeFileAsync(sourceMapDestPath, renderResult.output.map, { encoding: 'utf8' });
            };
        } else {
            writeSourceMap = function(value) {
                return Promise.resolve(value);
            };
        }

        debug('writing final css file to: %s', destPath);
        return fs.writeFileAsync(destPath, renderResult.output.css, { encoding: 'utf8' })
                    .then(writeSourceMap);

    }.bind(this), []).catch(LessError, function(error) {

        less.writeError(error.lessError, error.lessOptions);
        throw error;

    });

};

module.exports = Less;
