module.exports = function(grunt) {
    require('load-grunt-tasks')(grunt);
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
        },
        eslint: {
            target: [
                "./lib/cli-command.js",
                "./lib/cli-command-breakpoint.js",
                "./lib/cli-command-cmt.js",
                "./lib/cli-command-conf.js",
                "./lib/cli-command-exit.js",
                "./lib/cli-command-jump.js",
                "./lib/cli-command-mem.js",
                "./lib/cli-command-register.js",
                "./lib/cli-command-run.js",
                "./lib/cli-command-sendkey.js",
                "./lib/cli-command-step.js",
                "./lib/cli-command-stop.js",
                "./lib/cli-command-vram.js",
                "./lib/context.js",
                "./lib/ex_number.js",
                "./lib/flip-flop-counter.js",
                "./lib/fnuts.js",
                "./lib/ft-param.js",
                "./lib/get-package-json.js",
                "./lib/ic556.js",
                "lib/intel-8253.js",
                "lib/jquery.ddpanel.js",
                "lib/jquery.MZ-700-kb.js",
                "lib/jquery.MZ-700-vram.js",
                "lib/jquery.soundctrl.js",
                "lib/jquery.Z80-mem.js",
                "lib/jquery.Z80-reg.js",
                "lib/jquery_plugin_class.js",
                "lib/mzt-read-file.js",
                "lib/parse-addr.js",
                "lib/PCG-700.js",
                "./MZ-700/client.js",
                "./MZ-700/emulator.js",
                "./MZ-700/index.js",
                "./MZ-700/memory.js",
                "./MZ-700/mmio.js",
                "./MZ-700/monitor-rom.js",
                "./MZ-700/mz700-key-matrix.js",
                "./MZ-700/mz-data-recorder.js",
                "./MZ-700/mz-tape.js",
                "./MZ-700/mz-tape-header.js",
                "./MZ-700/sound.js",
                "./MZ-700/worker.js",
                "./Z80/assembler.js",
                "./Z80/bin-util.js",
                "./Z80/emulator.js",
                "./Z80/imem.js",
                "./Z80/memory-bank.js",
                "./Z80/memory-block.js",
                "./Z80/register.js",
                "./Z80/z80-line-assembler.js"
            ]
        }
    });

    grunt.loadNpmTasks("grunt-browserify");
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.registerTask("default", ["browserify", "uglify"]);
    grunt.registerTask('lint', ['eslint']);
};
