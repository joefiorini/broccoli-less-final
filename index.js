var CachingWriter = require('broccoli-caching-writer');
var Promise = require('bluebird');

var glob = Promise.promisify(require('glob'));
var fs = Promise.promisifyAll(require('fs'));
var path = require('path');
var less = require('less');
var mkdirp = require('mkdirp');
var defaults = require('lodash/object/defaults');
var clone = require('lodash/lang/cloneDeep');

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

        var lessOptions = {};
        lessOptions.filename = pathAndContents.filename;
        lessOptions.paths = paths;

        var plugins = this.lessOptions.plugins;
        delete this.lessOptions.plugins;

        lessOptions =
            defaults({}, lessOptions, clone(this.lessOptions));

        lessOptions.plugins = plugins;

        var resultFilename = pathAndContents.filename.replace('.less', '.css');
        var destPath = path.join(destDir, resultFilename);

        if (typeof this.outputFile === 'function') {
            resultFilename = this.outputFile(resultFilename);
            destPath = path.join(destDir, resultFilename);
        } else if(this.outputFile) {
            resultFilename = this.outputFile;
            destPath = path.join(path.dirname(destPath), this.outputFile);
        }

        if (lessOptions.sourceMap) {
            var sourceMapURL =
                lessOptions.sourceMap.sourceMapURL = path.basename(resultFilename) + '.map';
        }

        debug('using less options: %o', lessOptions);

        return less.render(pathAndContents.contents, lessOptions)
                    .then(function(output) {
                        debug('less output: %o', output);

                        var result =
                            {   filename: destPath,
                                dirname: path.dirname(destPath),
                                output: output
                            };

                        if (sourceMapURL) {
                            result.sourceMapURL = path.join(path.dirname(destPath), sourceMapURL);
                        }

                        return result;
                    }).catch(function(err) {
                        throw new LessError(err, lessOptions);
                    });

    }.bind(this)).reduce(function(result, renderResult) {

        var basePath = path.dirname(renderResult.filename);
        mkdirp.sync(basePath);
        var writeSourceMap;

        if (renderResult.output.map) {
            writeSourceMap = function() {
                debug('writing sourcemap to: %s', renderResult.sourceMapURL);
                return fs.writeFileAsync(renderResult.sourceMapURL, renderResult.output.map, { encoding: 'utf8' });
            };
        } else {
            writeSourceMap = function(value) {
                return Promise.resolve(value);
            };
        }

        debug('writing final css file to: %s', renderResult.filename);
        return fs.writeFileAsync(renderResult.filename, renderResult.output.css, { encoding: 'utf8' })
                    .then(writeSourceMap);

    }.bind(this), []).catch(LessError, function(error) {

        less.writeError(error.lessError, error.lessOptions);
        throw error;

    });

};

module.exports = Less;
