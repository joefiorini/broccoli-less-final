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
var builder;

function buildLessTree(tree, options) {
    tree = new Less(tree,
                        {   files: ['relative-imports/*.less']
                        });
    builder = new broccoli.Builder(tree);
    return builder.build();
}

describe('broccoli-less-final', function() {
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
