module.exports = function(grunt) {
    require('load-grunt-tasks')(grunt);
    grunt.initConfig({
        clean: [
            "./js/*.js",
            "./js/*.map",
        ],
        ts: {
            default: {
                files: [
                    {
                        src: [
                            "./Z80/*.ts",
                            "./lib/*.ts",
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
                        "MZ-700/mz700-emu-ws.js",
                    ],
                    "./js/mz700-emu.js": [
                        "MZ-700/mz700-emu.js",
                    ],
                    "./js/mz700-worker.js": [
                        "MZ-700/mz700-worker.js",
                    ],
                },
            },
            debug: {
                files: {
                    "./js/mz700-emu-ws.min.js": [
                        "MZ-700/mz700-emu-ws.js",
                    ],
                    "./js/mz700-emu.min.js": [
                        "MZ-700/mz700-emu.js",
                    ],
                    "./js/mz700-worker.min.js": [
                        "MZ-700/mz700-worker.js",
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
        copy: {
            default: {
                files: {
                    "./lib/codemirror.css": [
                        "./node_modules/codemirror/lib/codemirror.css",
                    ],
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
        "ts",
        "clean",
        "browserify:debug",
        "copy",
    ]);
    grunt.registerTask("release", [
        "ts",
        "clean",
        "browserify:release",
        "uglify",
        "copy",
    ]);
    grunt.registerTask("default", [
        "debug",
    ]);
};
