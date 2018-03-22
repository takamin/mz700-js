module.exports = function(grunt) {
    require('load-grunt-tasks')(grunt);
    grunt.initConfig({
        browserify: {
            build: {
                files: {
                    "./build/bundle-index.js": ["MZ-700/index.js"],
                    "./build/bundle-client.js": ["MZ-700/client.js"],
                    "./build/bundle-worker.js": ["MZ-700/worker.js"]
                }
            }
        },
        uglify: {
            build: {
                files: {
                    "./build/bundle-index.min.js": ["./build/bundle-index.js"],
                    "./build/bundle-client.min.js": ["./build/bundle-client.js"],
                    "./build/bundle-worker.min.js": ["./build/bundle-worker.js"]
                }
            }
        },
        copy: {
            "debug": {
                files: {
                    "./MZ-700/bundle-index.js": ["./build/bundle-index.js"],
                    "./MZ-700/bundle-client.js": ["./build/bundle-client.js"],
                    "./MZ-700/bundle-worker.js": ["./build/bundle-worker.js"]
                }
            },
            "release": {
                files: {
                    "./MZ-700/bundle-index.js": ["./build/bundle-index.min.js"],
                    "./MZ-700/bundle-client.js": ["./build/bundle-client.min.js"],
                    "./MZ-700/bundle-worker.js": ["./build/bundle-worker.min.js"]
                }
            }
        },
        eslint: {
            target: [ "." ]
        }
    });

    grunt.loadNpmTasks("grunt-browserify");
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-copy');

    grunt.registerTask('lint',      ['eslint']);
    grunt.registerTask("debug",     ["lint", "browserify", "copy:debug" ]);
    grunt.registerTask("release",   ["lint", "browserify", "uglify", "copy:release"]);
    grunt.registerTask("default",   ["debug"]);
};
