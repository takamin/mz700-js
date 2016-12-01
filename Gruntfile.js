module.exports = function(grunt) {
    grunt.initConfig({
        browserify: {
            build: {
                files: {
                    "MZ-700/bundle.js": ["MZ-700/index.js"],
                    "MZ-700/bundle-client.js": ["MZ-700/client.js"]
                }
            }
        }
    });

    grunt.loadNpmTasks("grunt-browserify");
    grunt.registerTask("default", ["browserify"]);
};
