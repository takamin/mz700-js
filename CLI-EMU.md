`mz700-cli` - RUN THE CLI EMULATOR with Node.js
===============================================

### COMMAND LINE

```
> mz700-cli [-c <mzt-filename>] [<mzt-filename>]
```

### OPTIONS

* c - Set a MZT file to the data recorder as CMT.

### PARAMETERS

* `<mzt-filename>` - A MZT-filename to be loaded to the memory immedietely.

### COMMANDS

* __`exit`__ - Exit from the emulator.
* __`run`__ - Run MZ-700 emulation.
* __`stop`__ - Stop emulation.
* __`step`__ _`[<num>]`_ - Execute N instructions and stop. num default is 1.
* __`vram`__ - Print VRAM to console.
* __`reg`__ - Print register.
* __`key`__ _`<input-strings>`_ - Convert the string to MZ-700's Key-Matrix, Then push those stroke.
* __`jp`__ _`<addr>`_ - Set the PC of Z80 CPU.
* __`mem set`__ _`<addr> <data> [ <data> ...]`_ - Write data to the memory
* __`mem dump`__ _`<addr>`_ - Print the contents of the memory.
* __`cmt set`__ _`<mzt-filename>`_ - Set CMT to the data recorder.
* __`cmt eject`__ - Eject CMT.
* __`cmt play`__ - Push the PLAY button of the data recorder.
* __`cmt rec`__ - Push the REC button of the data recorder.
* __`cmt stop`__ - Push the STOP button of the data recorder.
* __`bp set`__ _`<addr>`_ - Set break points at the address.
* __`bp rm`__ _`<addr>`_ - Remove the break points set at the address.
* __`bp clear`__ - Clear all break points.
* __`conf key duration make <num>`__ - Set key making duration by millisec.
* __`conf key duration release <num>`__ - Set key releasing duration by millisec.
* __`conf key duration make`__ - Print key making duration.
* __`conf key duration release`__ - Print key releasing duration.

#### Parameters for the commands

* _`<num>`_ : Number.
* _`<addr>`_, _`<data>`_ : Specify the address like `0123h` as hexadecimal or `1024` as decimal
* _`<input-string>`_ : String structured by the keys of the MZ-700 Key-Matrix.


