module.exports = function(grunt) {
    require('load-grunt-tasks')(grunt);
    grunt.initConfig({
        clean: [
            "./js/*.css",
            "./js/*.js",
            "./js/*.map",
            "./js/**/*.css",
            "./js/**/*.js",
            "./js/**/*.map",
        ],
        copy: {
            default: {
                files: {
                    "./js/": [
                        "./lib/jquery-plugin/*",
                        "./MZ-700/mz700-emu.css",
                    ],
                    "./js/lib/codemirror.css":
                        "./node_modules/codemirror/lib/codemirror.css",
                }
            }
        },
        ts: {
            default: {
                files: [
                    {
                        src: [
                            "./MZ-700/mz700-emu.ts",
                            "./MZ-700/mz700-worker.ts",
                            "./MZ-700/mz700-emu-ws.ts",
                        ]
                    },
                ],
                "tsconfig": "./tsconfig.json",
            },
        },
        browserify: {
            release: {
                files: {
                    "./js/mz700-emu-ws.js": [
                        "./js/MZ-700/mz700-emu-ws.js",
                    ],
                    "./js/mz700-emu.js": [
                        "./js/MZ-700/mz700-emu.js",
                    ],
                    "./js/mz700-worker.js": [
                        "./js/MZ-700/mz700-worker.js",
                    ],
                },
            },
            debug: {
                files: {
                    "./js/mz700-emu-ws.min.js": [
                        "./js/MZ-700/mz700-emu-ws.js",
                    ],
                    "./js/mz700-emu.min.js": [
                        "./js/MZ-700/mz700-emu.js",
                    ],
                    "./js/mz700-worker.min.js": [
                        "./js/MZ-700/mz700-worker.js",
                    ],
                },
            },
        },
        uglify: {
            default: {
                files: {
                    "./js/mz700-emu-ws.min.js": [
                        "./js/mz700-emu-ws.js",
                    ],
                    "./js/mz700-emu.min.js": [
                        "./js/mz700-emu.js",
                    ],
                    "./js/mz700-worker.min.js": [
                        "./js/mz700-worker.js",
                    ],
                },
                options: {
                    sourceMap: true,
                },
            },
        },
    });

    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks("grunt-ts");
    grunt.loadNpmTasks("grunt-browserify");
    grunt.loadNpmTasks('grunt-contrib-uglify-es');
    grunt.loadNpmTasks('grunt-contrib-copy');

    grunt.registerTask("debug", [
        "copy",
        "ts",
        "browserify:debug",
    ]);
    grunt.registerTask("release", [
        "copy",
        "ts",
        "browserify:release",
        "uglify",
    ]);
    grunt.registerTask("default", [
        "debug",
    ]);
};
