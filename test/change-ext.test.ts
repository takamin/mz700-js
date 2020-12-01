"use strict";
describe("fnuts", ()=>{
    const assert = require("chai").assert;
    const changeExt = require('../lib/change-ext');
    describe("changeExt", ()=>{
        describe("when the new extension has no dot in its medium position", ()=>{
            it("should exchange the extension", () => {
                assert.equal(
                    changeExt("/path/body.ext", ".new"),
                    "/path/body.new");
            });
            it("should exchange the extension when new ext has no dot", () => {
                assert.equal(
                    changeExt("/path/body.ext", "new"),
                    "/path/body.new");
            });
        });
        describe("when the new extension has a dot in its medium position", ()=>{
            it("should exchange the extension", () => {
                assert.equal(
                    changeExt("/path/body.ext", ".new.ext"),
                    "/path/body.new.ext");
            });
            it("should exchange the extension", () => {
                assert.equal(
                    changeExt("/path/body.ext", "new.ext"),
                    "/path/body.new.ext");
            });
        });
        describe("when the filename has no extension", ()=>{
            it("should add the extension", () => {
                assert.equal(
                    changeExt("/path/body_add", ".ext"),
                    "/path/body_add.ext");
            });
        });
    });
});