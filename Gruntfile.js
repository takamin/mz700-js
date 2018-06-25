module.exports = function(grunt) {
    require('load-grunt-tasks')(grunt);
    grunt.initConfig({
        browserify: {
            build: {
                files: {
                    "./build/bundle-mz700-emu.js": ["MZ-700/mz700-emu.js"],
                    "./build/bundle-mz700-worker.js": ["MZ-700/mz700-worker.js"]
                }
            }
        },
        uglify: {
            build: {
                files: {
                    "./build/bundle-mz700-emu.min.js": ["./build/bundle-mz700-emu.js"],
                    "./build/bundle-mz700-worker.min.js": ["./build/bundle-mz700-worker.js"]
                }
            }
        },
        copy: {
            "debug": {
                files: {
                    "./js/bundle-mz700-emu.js": ["./build/bundle-mz700-emu.js"],
                    "./js/bundle-mz700-worker.js": ["./build/bundle-mz700-worker.js"]
                }
            },
            "release": {
                files: {
                    "./js/bundle-mz700-emu.js": ["./build/bundle-mz700-emu.min.js"],
                    "./js/bundle-mz700-worker.js": ["./build/bundle-mz700-worker.min.js"]
                }
            }
        },
        eslint: {
            target: [ "." ]
        }
    });

    grunt.loadNpmTasks("grunt-browserify");
    grunt.loadNpmTasks('grunt-contrib-uglify-es');
    grunt.loadNpmTasks('grunt-contrib-copy');

    grunt.registerTask('lint',      ['eslint']);
    grunt.registerTask("debug",     ["lint", "browserify", "copy:debug" ]);
    grunt.registerTask("release",   ["lint", "browserify", "uglify", "copy:release"]);
    grunt.registerTask("default",   ["debug"]);
};
