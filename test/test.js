var expect = require('chai').expect;
var Less = require('..');
var Promise = require('bluebird');
var mkdirp = require('mkdirp');

process.on('unhandledRejection', function(err) {
    throw err;
});

var fs = require('fs');
var path = require('path');
var broccoli = require('broccoli');

var fixtures = path.join(__dirname, 'fixtures');
var external = path.join(__dirname, 'external');
var builder;

function buildLessTree(tree, options) {
    tree = new Less(tree, options);
    builder = new broccoli.Builder(tree);
    return builder.build();
}

describe('broccoli-less-final', function() {
    describe('general behavior', function() {
        it('passes given options to less', function() {
            return buildLessTree(fixtures,
                                 {  files: ['compressed/compressed.less'],
                                    lessOptions:
                                        {   compress: true,
                                            optimization: 10
                                        }
                                 }
            ).then(function(result) {
                expectFile('compressed/compressed.css').in(result);
            });
        });
        it('uses all given trees as load paths', function() {
            return buildLessTree([fixtures, external],
                                 {  files: ['external-imports/basic.less']
                                 }
            ).then(function(result) {
                expectFile('external-imports/basic.css').in(result);
            });
        });
    });

    describe('1-to-1 semantics', function() {
        it('writes an output file for each input file', function() {
            return buildLessTree(fixtures,
                                 {  files: ['1-to-1/*.less']
                                 }
            ).then(function(result) {
                expectFile('1-to-1/first.css').in(result);
                expectFile('1-to-1/second.css').in(result);
            });
        });

        it('supports directory-relative imports', function() {
            return buildLessTree(fixtures,
                                 { files: ['relative-imports/*.less']
                                 }
            ).then(function(result) {
                expectFile('relative-imports/first.css').in(result);
            });
        });

        describe('sourcemaps', function() {
            it('includes sourcemap file in output @solo', function() {
                return buildLessTree(fixtures,
                                     {  files: ['1-to-1/*.less'],
                                        lessOptions:
                                            {   sourceMap: {}
                                            }
                                     }
                ).then(function(result) {
                    expectFile('1-to-1/first.css.map').in(result);
                    expectFile('1-to-1/second.css.map').in(result);
                });
            });
        });
    });

    describe('n-to-1 semantics', function() {
        it('writes a single output file for a single input file', function() {
            return buildLessTree(fixtures,
                                 {  inputFile: 'n-to-1/main.less'
                                 }
            ).then(function(result) {
                expectFile('n-to-1/main.css').in(result);
            });
        });
    });
});

function expectFile(filename) {
  function inner(result) {
    var actualContent = fs.readFileSync(path.join(result.directory, filename), 'utf-8');
    mkdirp.sync(path.dirname(path.join(__dirname, 'actual', filename)));
    fs.writeFileSync(path.join(__dirname, 'actual', filename), actualContent);

    var expectedContent;
    try {
      expectedContent = fs.readFileSync(path.join(__dirname, 'expected', filename), 'utf-8');
    } catch (err) {
      console.warn("Missing expected file: " + path.join(__dirname, 'expected', filename));
    }

    expect(actualContent).to.equal(expectedContent, "discrepancy in " + filename);
  }
  return { in: inner };
}
