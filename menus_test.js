define(function(require, exports, module) {
    main.consumes = ["c9", "plugin.test", "menus"];
    main.provides = [];
    return main;

    function main(options, imports, register) {
	var menus = imports.menus;
        var c9 = imports.c9;

        var test = imports["plugin.test"];

        var describe = test.describe;
        var it = test.it;
        var assert = test.assert;

        describe("cs50.menus", function() {
            this.timeout(2000);

            describe("captions", function() {
                function testCaption(path, caption) {
                    it("should rename " + path + " to " + caption, function() {
                        assert(menus.get(path).item.getAttribute("caption") === caption);
                    });
                }

                var items = [
                    { path: "Cloud9", caption: "CS50 IDE" },
                    { path: "Cloud9/Restart Workspace", caption: "Restart", hosted: true },
                    { path: "Cloud9/Quit Cloud9", caption: "Log Out", hosted: true },
                    { path: "Goto", caption: "Go" },
                    { path: "Goto/Goto Anything...", caption: "Anything..." },
                    { path: "Goto/Goto Line...", caption: "Line..." },
                    { path: "Goto/Goto Symbol...", caption: "Symbol..." },
                    { path: "Goto/Goto Command...", caption: "Command..." },
                    { path: "Support/Check Cloud9 Status", caption: "Cloud9 Status", hosted: true },
                    { path: "Support/Read Documentation", caption: "Cloud9 Documentation", hosted: true }
                ];

                for (var i in items) {
                    if (typeof items[i].hosted === "boolean" && items[i].hosted !== c9.hosted)
                        continue;

                    testCaption(items[i].path, items[i].caption);
                }
            });

            if (c9.hosted) {
                describe("user menu", function() {
                    function testItemRemoved(caption) {
                        it("should remove user_menu/" + caption, function(done) {
                            info.getUser(function(err, user) {
                                if (err)
                                    return done(err);

                                assert(!menus.get("user_" + user.id + "/" + caption).item);
                                done();
                            });
                        });
                    }

                    ["Account", "Dashboard", "Home", "Log out"].forEach(testItemRemoved);
                });

                it("should move CS50 IDE/Dashboard above CS50 IDE/Preferences", function() {
                    assert(menus.get("Cloud9/Go To Your Dashboard").item.nextSibling.caption === "Preferences");
                });

                it("should add CS50 IDE/Account", function() {
                    assert(menu.get("Cloud9/Account"));
                });
            }
            else {
                describe("hidden menus/items (offline)", function() {
                    it("should hide CS50 IDE/Dashboard offline", function() {
                        assert(menus.get("Cloud9/Go To Your Dashboard").item.getAttribute("visible") === false);
                    });

                    it("should hide CS50 IDE/Log Out offline", function() {
                        assert(menus.get("Cloud9/Quit Cloud9").item.getAttribute("visible") === false);
                    });

                    it("should hide Window/Collaborate offline", function() {
                        assert(menus.get("Window/Collaborate").item.getAttribute("visible") === false);
                    });

                    it("should hide CS50 IDE/Restart Cloud9", function() {
                        assert(menus.get("Cloud9/Restart Cloud9").item.getAttribute("visible") === false);
                    });
                });
            }

            describe("added items", function() {
                it("should add About CS50/CS50 IDE", function() {
                    assert(menus.get("Cloud9/About CS50").item);
                });

                it("should add CS50 IDE/What's New?", function() {
                    assert(menus.get("Cloud9/What's New?").item);
                });
            });

            describe("divs", function() {
                it("should add div before CS50 IDE/About Cloud9", function() {
                    assert(menus.get("Cloud9/About Cloud9").item.previousSibling.localName === "divider");
                });

                it("should add div after CS50 IDE/Preferences", function() {
                    assert(menus.get("Cloud9/Preferences").item.nextSibling.localName === "divider");
                });
            });

            // div after "Preferences" shows after toggling less-comfy

            describe("hidden menus/items", function() {
                it("should hide Run menu", function() {
                    console.log(menus.get("Run"));
                    assert(menus.get("Run").item.getAttribute("visible") === false);
                });
            });

            // Menu items are toggled
        });

        register(null, {});
    }
});
