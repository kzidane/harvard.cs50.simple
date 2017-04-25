define(function() {
    main.consumes = ["c9", "cs50.simple", "info", "menus", "Plugin", "ui"];
    main.provides = ["cs50.menus"];
    return main;

    function main(options, imports, register) {
        var c9 = imports.c9;
        var info = imports.info;
        var menus = imports.menus;
        var Plugin = imports.Plugin;
        var simple = imports["cs50.simple"];
        var ui = imports.ui;

        var plugin = new Plugin("CS50", main.consumes);

        function toggleItems(lessComfortable) {
            [
                // CS50 IDE
                "Cloud9/Open Your Project Settings",
                "Cloud9/Open Your User Settings",
                "Cloud9/Open Your Keymap",
                "Cloud9/Open Your Init Script",
                "Cloud9/Open Your Stylesheet",

                // File
                "File/Revert to Saved",
                "File/Revert All to Saved",
                "File/Mount FTP or SFTP server...",
                "File/Line Endings",
                "File/New Plugin",

                // extraneous templates
                "File/New From Template/Text file",
                "File/New From Template/CoffeeScript file",
                "File/New From Template/XML file",
                "File/New From Template/XQuery file",
                "File/New From Template/SCSS file",
                "File/New From Template/LESS file",
                "File/New From Template/SVG file",
                "File/New From Template/Ruby file",
                "File/New From Template/OCaml file",
                "File/New From Template/Clojure file",
                "File/New From Template/Markdown",
                "File/New From Template/Express file",
                "File/New From Template/Node.js web server",

                // Edit
                "Edit/Line/Move Line Up",
                "Edit/Line/Move Line Down",
                "Edit/Line/Copy Lines Up",
                "Edit/Line/Copy Lines Down",
                "Edit/Line/Remove Line",
                "Edit/Line/Remove to Line End",
                "Edit/Line/Remove to Line Start",
                "Edit/Line/Split Line",
                "Edit/Keyboard Mode",
                "Edit/Selection",
                "Edit/Text",
                "Edit/Code Folding",
                "Edit/Code Formatting",

                // Find
                "Find/Replace Next",
                "Find/Replace Previous",
                "Find/Replace All",

                // View
                "View/Editors",
                "View/Syntax",
                "View/Wrap Lines",
                "View/Wrap To Print Margin",

                // Goto
                "Goto/Goto Anything...",
                "Goto/Goto Symbol...",
                "Goto/Goto Command...",
                "Goto/Next Error",
                "Goto/Previous Error",
                "Goto/Word Right",
                "Goto/Word Left",
                "Goto/Scroll to Selection",

                // Tools
                "Tools",

                // Window
                "Window/New Immediate Window",
                "Window/Installer...",
                "Window/Navigate",
                "Window/Commands",
                "Window/Presets",
                "Window/Changes",

                // Support
                "Support",
            ].forEach(function(path) {
                showItem(path, !lessComfortable);
            });
        }

        function simplifyMenus() {

            // hide menu items offline
            if (!c9.hosted) {
                [
                    "Cloud9/Go To Your Dashboard",
                    "Cloud9/Quit Cloud9",
                    "Window/Collaborate"
                ].forEach(function(path) {
                    showItem(path, false);
                });
            }

            // hide Run menu
            [
                "Cloud9/Restart Cloud9",
                "Run"
            ].forEach(function(path) {
                showItem(path, false);
            });
        }

        function getItem(path, cbFound, cbNotFound) {
            var item = menus.get(path).item;

            if (item && typeof cbFound === "function")
                cbFound(item);
            else if (typeof cbNotFound === "function")
                cbNotFound();
        }

        function moveItem(path, index, targetPath) {
            getItem(targetPath || path, function(item) {
                menus.addItemByPath(path, item, index, plugin);
            });
        }

        function setItemAttribute(path, attribute, value) {
            getItem(path, function(item) {
                item.setAttribute(attribute, value);
            });
        }

        function setItemCaption(path, caption) {
            setItemAttribute(path, "caption", caption);
        }

        function showItem(path, visible) {
            setItemAttribute(path, "visible", visible);
        }

        function updateCaptions() {
            var captions = {
                "Cloud9": "CS50 IDE",
                "Cloud9/Go To Your Dashboard": "Dashboard",
                "Cloud9/Quit Cloud9": "Log Out",
                "Cloud9/Restart Workspace": "Restart",
                "Goto": "Go",
                "Goto/Goto Anything...": "Anything...",
                "Goto/Goto Line...": "Line...",
                "Goto/Goto Symbol...": "Symbol...",
                "Goto/Goto Command...": "Command...",
                "Support/Check Cloud9 Status": "Cloud9 Status",
                "Support/Read Documentation": "Cloud9 Documentation"
            };

            // update captions
            for (var path in captions)
                setItemCaption(path, captions[path]);
        }

        plugin.on("load", function() {

            // move "Dashboard" above "Preferences"
            moveItem("Cloud9/Go To Your Dashboard", 299);

            if (c9.hosted) {
                info.getUser(function(err, user) {
                    if (user && user.id) {
                        var root = "user_" + user.id + "/";

                        // move "Account" to CS50 IDE menu
                        // TODO
                        moveItem("Cloud9/Account", root + "Account", 298);

                        // simplify user menu
                        ["Dashboard", "Home", "Log out"].forEach(function(item) {
                            menus.remove(root + item);
                        });
                    }
                });
            }

            // add "About CS50"
            menus.addItemByPath("Cloud9/About CS50", new ui.item({
                caption: "About CS50",
                onclick: function() {
                    window.open("https://cs50.harvard.edu/", "_blank");
                }
            }), 0, plugin);

            // add divider before "About Cloud9"
            menus.addItemByPath("Cloud9/~", new ui.divider(), 50, plugin);

            // add "What's New?"
            menus.addItemByPath("Cloud9/What's New?", new ui.item({
                caption: "What's New?",
                onclick: function() {
                    window.open("http://docs.cs50.net/ide/new.html", "_blank");
                }
            }), 1, plugin);

            // add divider after "Preferences"
            var div = new ui.divider();
            menus.addItemByPath("Cloud9/~", div, 301, plugin);
            simple.on("lessComfortable", function(lessComfortable) {
                toggleItems(lessComfortable);
                if (!lessComfortable)
                    div.show();
            });

            updateCaptions();
            simplifyMenus();
         });

         plugin.freezePublicAPI({});
         register(null, { "cs50.menus": plugin });
    }

});
