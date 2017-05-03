module.exports = function(grunt) {
    grunt.initConfig({
        browserify: {
            build: {
                files: {
                    "MZ-700/bundle.js": ["MZ-700/index.js"],
                    "MZ-700/bundle-client.js": ["MZ-700/client.js"],
                    "MZ-700/bundle-worker.js": ["MZ-700/worker.js"]
                }
            }
        },
        uglify: {
            my_target: {
                files: {
                    "MZ-700/bundle.min.js" : ["MZ-700/bundle.js"],
                    "MZ-700/bundle-client.min.js" : ["MZ-700/bundle-client.js"],
                    "MZ-700/bundle-worker.min.js" : ["MZ-700/bundle-worker.js"]
                }
            }
        }
    });

    grunt.loadNpmTasks("grunt-browserify");
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.registerTask("default", ["browserify", "uglify"]);
};
