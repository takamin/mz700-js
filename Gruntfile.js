module.exports = function(grunt) {
    require('load-grunt-tasks')(grunt);
    grunt.initConfig({
        browserify: {
            build: {
                files: {
                    "./build/bundle-emu.js": ["MZ-700/MZ-700-emu.js"],
                    "./build/bundle-worker.js": ["MZ-700/MZ-700-worker.js"]
                }
            }
        },
        uglify: {
            build: {
                files: {
                    "./build/bundle-emu.min.js": ["./build/bundle-emu.js"],
                    "./build/bundle-worker.min.js": ["./build/bundle-worker.js"]
                }
            }
        },
        copy: {
            "debug": {
                files: {
                    "./MZ-700/bundle-emu.js": ["./build/bundle-emu.js"],
                    "./MZ-700/bundle-worker.js": ["./build/bundle-worker.js"]
                }
            },
            "release": {
                files: {
                    "./MZ-700/bundle-emu.js": ["./build/bundle-emu.min.js"],
                    "./MZ-700/bundle-worker.js": ["./build/bundle-worker.min.js"]
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
