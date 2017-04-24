define(function(require, exports, module) {
    "use strict";

    main.consumes = [
        "ace", "ace.status", "auth", "c9", "clipboard", "collab",
        "collab.workspace", "commands", "console",
        "dialog.notification", "immediate", "info",  "keymaps", "navigate",
        "outline", "layout", "login", "Menu", "menus", "panels",
        "Plugin", "preferences", "preview", "run.gui", "save", "settings",
        "tabbehavior", "tabManager", "terminal", "tooltip", "tree", "ui", "util"
    ];
    main.provides = ["cs50.simple"];
    return main;

    function main(options, imports, register) {
        var auth = imports.auth;
        var c9 = imports.c9;
        var collab = imports.collab;
        var commands = imports.commands;
        var info = imports.info;
        var layout = imports.layout;
        var menus = imports.menus;
        var notify = imports["dialog.notification"].show;
        // outline adds "Goto/Goto Symbol..."
        // listing it as dependency ensures item exists before simple is loaded
        var outline = imports.outline;

        var panels = imports.panels;
        var Plugin = imports.Plugin;
        var prefs = imports.preferences;
        var save = imports.save;
        var settings = imports.settings;
        var tabManager = imports.tabManager;
        var tabMenu = imports.tabbehavior.contextMenu;
        var tree = imports.tree;
        var ui = imports.ui;
        var workspace = imports["collab.workspace"];

        var plugin = new Plugin("CS50", main.consumes);
        var emit = plugin.getEmitter();

        var SETTINGS_VER = 9;

        // https://lodash.com/docs
        var _ = require("lodash");
        var basename = require("path").basename;

        var libterm = require("plugins/c9.ide.terminal/aceterm/libterm").prototype;

        var authorInfoToggled = null;
        var avatar = null;
        var divs = [];
        var foldAvailFuncs = {};
        var lessComfortable = true;
        var presenting = false;
        var terminalSound = null;
        var trailingLine = null;

        /**
         * Hides avatar in offline IDE. Adds preference to toggle between
         * Gravatar and C9 logo in online IDE only.
         *
         * @param err ideally passed by info.getUser in case of an error
         * @param user a user object with property id
         */
        function addGravatarToggle(err, user) {
            if (!err && user && user.id) {
                // get avatar button
                avatar = menus.get("user_" + user.id).item;
                if (!avatar)
                    return;
                else if (!c9.hosted)
                    // hide avatar in offline IDE
                    return hide(avatar);

                // add toggle in preferences
                prefs.add({
                   "CS50" : {
                        position: 5,
                        "IDE Behavior" : {
                            position: 10,
                            "Gravatar" : {
                                type: "checkbox",
                                setting: "user/cs50/simple/@gravatar",
                                min: 1,
                                max: 200,
                                position: 190
                            }
                        }
                    }
                }, plugin);

                // retrieve initial gravatar setting
                toggleGravatar(settings.getBool("user/cs50/simple/@gravatar"));

                // handle toggling gravatar setting
                settings.on("user/cs50/simple/@gravatar", toggleGravatar);
            }
        }

        /**
         * Adds the buttons to toggle comfort level
         */
        function addToggle() {

            // creates the toggle menu item
            var toggle = new ui.item({
                type: "check",
                caption: "Less Comfortable",
                onclick: toggleSimpleMode
            });

            // places it in View tab
            menus.addItemByPath("View/Less Comfortable", toggle, 0, plugin);

            // add divider before "Editors"
            var div = new ui.divider();
            menus.addItemByPath("View/~", div, 10, plugin);

            // cache divider to show in more-comfy
            divs.push(div);

            // add preference pane button
            prefs.add({
               "CS50" : {
                    position: 5,
                    "IDE Behavior" : {
                        position: 10,
                        "Less Comfortable Mode" : {
                            type: "checkbox",
                            setting: "user/cs50/simple/@lessComfortable",
                            min: 1,
                            max: 200,
                            position: 190
                        },
                        "Mark Undeclared Variables" : {
                            type: "checkbox",
                            setting: "user/cs50/simple/@undeclaredVars",
                            min: 1,
                            max: 200,
                            position: 190
                        },
                        "Audible Terminal Bell" : {
                            type: "checkbox",
                            setting: "user/cs50/simple/@terminalSound",
                            min: 1,
                            max: 200,
                            position: 190
                        }
                    }
                }
            }, plugin);
        }

        /**
         * Adds tooltips to console buttons
         */
        function addTooltips() {

            // adds tooltips as a callback after the consoleButtons are created
            imports.console.getElement("consoleButtons", function(aml) {
                aml.childNodes[0].setAttribute("tooltip", "Maximize Console");
                aml.childNodes[2].setAttribute("tooltip", "Close Console");
            });
        }

        /**
         * Adds trailing newline to text files upon saving (if enabled)
         *
         * @param {object} e an object as passed by save.beforeSave event's
         * callback
         */
        function addTrailingLine(e) {
            if (trailingLine === null) {
                // add preference toggle
                prefs.add({
                    "Project": {
                        position: 10,
                        "Code Editor (Ace)": {
                            "On Save, Add Trailing Newline": {
                                type: "checkbox",
                                position: 300,
                                path: "project/cs50/ace/@trailingLine"
                            }
                        }
                    }
                }, plugin);

                // update trailingLine when pref changes
                settings.on("project/cs50/ace/@trailingLine", function(enabled) {
                    trailingLine = enabled;
                });

                // whether to add trailing line to text files upon saving
                trailingLine = settings.getBool("project/cs50/ace/@trailingLine");

                // add trailing line to text files upon saving (if enabled)
                save.on("beforeSave", addTrailingLine);
            }
            else if (trailingLine === true && _.isObject(e) && _.isObject(e.tab)
                && e.tab.editorType === "ace" && _.isString(e.tab.path)
                && _.isObject(e.document)
                && /^makefile$|\.(?:c|css|h|html|php|py|rb|sh)$/i.test(basename(e.tab.path))) {

                // Ace Document (https://ace.c9.io/#nav=api&api=document)
                var doc = e.document.getSession().session.getDocument();

                // number of lines in the document
                var length = doc.getLength();

                // insert trailing line only if last line isn't newline
                if (trailingLine && doc.getLine(length - 1) !== "")
                    doc.insertFullLines(length, [""]);
            }
        }

        /**
         * Hides the given div by changing CSS
         *
         * @param {AMLElement} the AMLElement to hide
         * @return true if successfuly hides, false otherwise
         */
        function hide(aml) {
            if (aml) {
                aml.setAttribute("visible", false);
                return true;
            }

            return false;
        }

        /**
         * Hides unneeded elements.
         */
        function hideElements() {
            // hide "Collaborate" panel offline
            if (!c9.hosted) {
                // remove panel button
                collab.disable();
            }

            // get parent of "Preview" and "Run" buttons
            var p = layout.findParent({ name: "preview" });

            // hide the divider
            hide(p.childNodes[0]);

            // hide the "Preview" button
            hide(p.childNodes[1]);

            // hide the "Run" button
            hide(p.childNodes[2]);

            // hide "Run" and "Preview" items from file browser's menu
            tree.on("menuUpdate", function(e) {
                if (!e.menu)
                    return;

                e.menu.childNodes.some(function(item) {
                    return item.caption === "Run" && hide(item);
                });
            });

            // hide "Run This File" item from tab context menu
            tabMenu.once("prop.visible", function(e) {
                e.currentTarget.childNodes.some(function(item) {
                    if (item.caption === "Run This File")
                        return hide(item);
                });
            });

            // disable "Run" through keyboard
            commands.bindKey(null, commands.commands["run"], true);
            commands.bindKey(null, commands.commands["runlast"], true);
        }

        /**
         * Hides gear icon
         */
        function hideGearIcon() {
            var bar = layout.findParent({name: "preferences"});
            if (bar.childNodes) {
                bar.childNodes.forEach(function(node) {
                    if (node.class === "preferences")
                        hide(node);
                });
            }
        }

        /**
         * Initially sets the title of the web page to title of focused IDE tab
         * (if any) and registers event handlers to update title when necessary.
         */
        function setTitleFromTabs() {
            // udpate document title initially
            updateTitle(tabManager.focussedTab);

            // update document title when tab is focused
            tabManager.on("focusSync", function(e) {
                updateTitle(e.tab);
            }, plugin);

            // update document title when tab is destroyed
            tabManager.on("tabDestroy", function(e) {
                if (e.last)
                updateTitle();
            }, plugin);

            // update document title when preference is toggled
            settings.on("user/tabs/@title", function() {
                updateTitle(tabManager.focussedTab);
            });
        }

        /**
         * Set the Terminal tab title to the current working directory
         */
        function setTmuxTitle(tab){
            // check if the tab exists and it is a terminal tab
            if (tab && tab.editorType === "terminal") {
                var session = tab.document.getSession();
                tab.document.on("setTitle", function(e) {
                    // fetch title from the object, fall back on tab
                    var title = e.title || tab.document.title;

                    // remove terminating ' - ""', if it exists
                    var re = /\s-\s""\s*$/;
                    if (title && re.test(title)) {
                        title = title.replace(re, "");

                        // list of items whose title should change
                        var docList = [e, tab.document];

                        if (session && session.hasOwnProperty("doc"))
                            docList.push(session.doc, session.doc.tooltip);

                        // fix all titles
                        docList.forEach(function(doc) {
                            if (doc.hasOwnProperty("title"))
                                doc.title = title;

                            if (doc.hasOwnProperty("tooltip"))
                                doc.tooltip = title;
                        });
                    }
                }, plugin);
            }
        }

        /**
         * Shows the given AMLElement
         *
         * @param {AMLElement} the AMLElement to show
         * @return true if successfully shows, false otherwise
         */
        function show(aml) {
            if (aml) {
                aml.setAttribute("visible", true);
                return true;
            }
            return false;
        }

        /**
         * Toggles code folding
         *
         * @param {boolean} enable whether to enable code folding
         */
        function toggleCodeFolding(enable) {
            if (_.isBoolean(enable)) {
                if (!enable) {
                    function getFalse() {
                        return false;
                    }

                    // cache fold-commands' isAvailable functions
                    if (_.isEmpty(foldAvailFuncs)) {
                        [
                            "fold", "foldall", "foldOther", "toggleFoldWidget",
                            "toggleParentFoldWidget"
                        ].forEach(function(name) {
                            var command = commands.commands[name];
                            if (command && command.isAvailable)
                                foldAvailFuncs[name] = command.isAvailable;
                        });
                    }

                    // unfold all folded code
                    tabManager.getTabs().forEach(function(tab) {
                        commands.exec("unfoldall", tab.editor);
                    });

                    // disable keyboard-shortcut colding by disabling commands
                    for (var name in foldAvailFuncs)
                        commands.commands[name].isAvailable = getFalse;
                }
                else {
                    // enable folding with keyboard shortcuts
                    for (var name in foldAvailFuncs)
                        commands.commands[name].isAvailable = foldAvailFuncs[name];
                }

                settings.set("user/ace/@showFoldWidgets", enable);
            }
        }

        /**
         * Toggles avatar between Gravatar and C9 logo
         *
         * @param show whether to show Gravatar
         */
        function toggleGravatar(show) {
            if (!_.isBoolean(show))
                return;

            if (avatar && avatar.$ext) {
                // switch between Gravatar and C9 logo
                if (show)
                    avatar.$ext.classList.remove("c9-logo");
                else
                    avatar.$ext.classList.add("c9-logo");
            }
        }

        /**
         * Toggles the button in top left that minimizes the menu bar
         */
        function toggleMiniButton(lessComfortable) {
            // menu bar
            var bar = layout.findParent(menus);
            if (bar && bar.childNodes[0]) {
                var minimizeBtn = bar.childNodes[0].childNodes[0];
                if (minimizeBtn) {
                    // hide minimize button in less-comfy only
                    minimizeBtn.setAttribute("visible", !lessComfortable);

                    // left-align "CS50 IDE" menu within menu bar
                    bar.$int.style.paddingLeft = lessComfortable ? "0" : "";
                }
            }
        }

        /**
         * Toggles menu simplification that you get when you click the plus icon
         */
        function togglePlus(lessComfortable) {
            var toggle = lessComfortable ? hide : show;

            // finds the menu bar and then executes callback
            tabManager.getElement("mnuEditors", function(menu) {
                var menuItems = menu.childNodes;

                // tries to toggle the menu items on the plus sign
                // until it works (sometimes this is called before they load)
                var test = setInterval(function() {
                    if (toggle(menuItems[2]) &&
                        toggle(menuItems[3]) &&
                        toggle(menuItems[4])) {
                        clearInterval(test);
                    }
                }, 0);
            });
        }

        /**
         * Toggles the left Navigate and Commands side tabs
         */
        function toggleSideTabs(lessComfortable) {
            var panelList = ["navigate", "commands.panel", "scm"];

            // remember tree visibility status
            var resetVisibility = tree.active ? tree.show : tree.hide;

            // temporarily overcomes a bug in C9 (tree is forcibly hidden by enabling panels)
            tree.hide();

            if (lessComfortable)
                // only shows tabs automatically when less comfortable is disabled
                panelList.forEach(function(p) {panels.disablePanel(p);});
            else
                panelList.forEach(function(p) {panels.enablePanel(p);});

            // reset tree visibility status
            resetVisibility();
        }

        /**
         * Toggles whether or not simple mode is enabled
         */
        function toggleSimpleMode(override) {

            // if we're unloading, remove menu customizations but don't save
            if (_.isBoolean(override))
                lessComfortable = override;
            else {
                // toggle comfort level
                lessComfortable = !lessComfortable;
                settings.set("user/cs50/simple/@lessComfortable", lessComfortable);
            }

            // toggle features
            toggleMiniButton(lessComfortable);
            toggleSideTabs(lessComfortable);
            togglePlus(lessComfortable);
            toggleCodeFolding(!lessComfortable);

            // make sure that the checkbox is correct
            menus.get("View/Less Comfortable").item.checked = lessComfortable;

            emit("lessComfortable", lessComfortable);
        }

        /**
         * Enables or disables terminal sound.
         *
         * @param {boolean} enable whether to enable terminal sound
         */
        function toggleTerminalSound(enable) {
            libterm && (libterm.bell = (enable === true)
                ? function() { terminalSound.play(); }
                : function() {});
        }

        /**
         * Disables warnings about undeclared variables for JavaScript files
         *
         * @param {object} e a JSON as passed by tabManager.tabAfterActivate's callback
         */
        function toggleUndeclaredVars(e) {
            // ensure tab is ace
            if (e && e.tab && e.tab.editorType === "ace") {
                // disable warnings about undeclared vars for js files
                if (/\.js$/i.test(e.tab.path)) {
                    return settings.set("project/language/@undeclaredVars", false);
                }
                // handle renaming tabs
                else if (e.tab.document) {
                    // handle setting/updating document title
                    e.tab.document.once("setTitle", function(e) {
                        if (/\.js$/i.test(e.title))
                            settings.set("project/language/@undeclaredVars", false);
                    });
                }

                // enable warnings about undeclared vars for other files
                settings.set("project/language/@undeclaredVars", true);
            }
        }

        /**
         * Enables author info when workspace is shared only.
         */
        function updateAuthorInfo(force) {
            // whether to force enable or disable the setting (without saving)
            if (_.isBoolean(force))
                authorInfoToggled = force;

            // handle when author info should be automatically toggled
            if (authorInfoToggled === true) {
                settings.set("user/collab/@show-author-info", workspace.members.length > 1);
            }
            // reset default setting when automatic toggling is disabled
            else if (authorInfoToggled === false) {
                settings.set(
                    "user/collab/@show-author-info",
                    settings.getBool("user/cs50/simple/collab/@originAuthorInfo")
                );
            }
        }

        /**
         * Updates items of "View > Font Size".
         */
        function updateFontSize() {
            /**
             * @return true if editor type of focused tab is ace or terminal.
             * false otherwise.
             */
            function isAvailable() {
                var type = _.isObject(tabManager.focussedTab)
                    && tabManager.focussedTab.editorType;
                if (_.isString(type))
                    return _.indexOf(["ace", "hex", "terminal"], type) > -1;
            };

            // cache and delete keyboard shortcuts for largerfont & smallerfont
            var largerfontKeys = commands.commands.largerfont.bindKey;
            delete commands.commands.largerfont.bindKey;
            var smallerfontKeys = commands.commands.smallerfont.bindKey;
            delete commands.commands.smallerfont.bindKey;

            // command for increasing font sizes of ace and terminal
            commands.addCommand({
                name: "largerfonts",
                exec: function() {
                    // increase ace's font size
                    var size = settings.getNumber("user/ace/@fontSize");
                    settings.set("user/ace/@fontSize", ++size > 72 ? 72 : size);

                    // increase terminal's font size
                    size = settings.getNumber("user/terminal/@fontsize");
                    settings.set("user/terminal/@fontsize", ++size > 72 ? 72 : size);
                },
                bindKey: largerfontKeys,
                isAvailable: isAvailable
            }, plugin);


            // command for resetting font sizes of ace and terminal to defaults
            commands.addCommand({
                name: "resetfonts",
                exec: function() {
                    var ace = 12;
                    var terminal = 12;

                    // determine default font sizes depending on current mode
                    if (presenting)
                        ace = terminal = 20;

                    // reset font sizes of ace and terminal to defaults
                    settings.set("user/ace/@fontSize", ace);
                    settings.set("user/terminal/@fontsize", terminal);
                },
                bindKey: {
                    mac: "Command-Ctrl-0",
                    win: "Alt-Ctrl-0"
                },
                isAvailable: isAvailable,
            }, plugin);

            // command for decreasing font sizes of ace and terminal
            commands.addCommand({
                name: "smallerfonts",
                exec: function() {
                    // decrease ace's font size
                    var size = settings.getNumber("user/ace/@fontSize");
                    settings.set("user/ace/@fontSize", --size < 1 ? 1 : size);

                    // decrease terminal's font size
                    size = settings.getNumber("user/terminal/@fontsize");
                    settings.set("user/terminal/@fontsize", --size < 1 ? 1 : size);
                },
                bindKey: smallerfontKeys,
                isAvailable: isAvailable
            }, plugin);

            // override behaviors of "Increase Font Size" & "Decrease Font Size"
            menus.get("View/Font Size/Increase Font Size").item.setAttribute(
                "command", "largerfonts"
            );
            menus.get("View/Font Size/Decrease Font Size").item.setAttribute(
                "command", "smallerfonts"
            );

            // add "Reset Font Size"
            menus.addItemByPath("View/Font Size/Reset Font Size", new ui.item({
                command: "resetfonts",
            }), 150, plugin);
        }

        /**
         * Sets and updates the title of the browser tab.
         */
        function updateTitle(tab) {
            var title = "CS50 IDE";

            // append "Offline" to offline IDE title
            if (!c9.hosted)
                title += " Offline";

            // prepend tab title when should
            document.title = tab && settings.getBool("user/tabs/@title")
                && tab.title
                ? tab.title + " - " + title
                : title
        }

        /**
         * Warns about unsaved file when focusing terminal
         */
        function warnUnsaved() {
            /**
             * Shows the warning
             *
             * @param {string} title the title of the unsaved file
             */
            function show(title) {
                // clear current timer (if any)
                if (notify.timer)
                    clearTimeout(notify.timer);

                // extend timeout if notifying about same title
                if (title === notify.currTitle && _.isFunction(notify.hasClosed) && !notify.hasClosed()) {
                    notify.timer = setTimeout(notify.hide, 5000);
                    return;
                }

                // hide old notification (if any)
                if (_.isFunction(notify.hide)) {
                    notify.hide();

                    // wait for old notification to be closed before showing
                    if (_.isFunction(notify.hasClosed) && !notify.hasClosed()) {
                        notify.hasClosed.interval = setInterval(function() {
                            clearInterval(notify.hasClosed.interval);
                            show(title);
                        }, 300);

                        return;
                    }
                }

                // new notification
                var div = '<div class="cs50-unsaved-notification">You haven\'t saved your changes to <pre>' + title + '</pre> yet.</div>';

                // show new notification
                notify.hide = notify(div, true);

                // shortcut for hasClosed
                notify.hasClosed = notify.hide.hasClosed;

                // cache current title
                notify.currTitle = title;

                // timeout before hiding notification automatically
                notify.timer = setTimeout(notify.hide, 5000);

            }

            // handle when a tab goes blur
            tabManager.on("blur", function(e) {
                var blurTab = e.tab;
                var doc = blurTab.document;

                // ensure blur tab is ace
                if (!blurTab || blurTab.editorType !== "ace" || !doc)
                    return;

                // wait for a tab to be focussed
                tabManager.once("focus", function(e) {
                    if (e.tab.editorType === "terminal" && doc.changed) {
                        show(blurTab.title);

                        // hide notification when tab is closed
                        blurTab.on("close", function() {
                            if (notify.currTitle === blurTab.title && _.isFunction(notify.hide))
                                notify.hide();
                        });
                    }
                });
            });

            // hide notification on save
            save.on("afterSave", function(e) {
                if (notify.currTitle === e.tab.title && _.isFunction(notify.hide))
                    notify.hide();
            });
        }

        var loaded = false;
        function load() {
            if (loaded)
               return false;

            loaded = true;

            ui.insertCss(require("text!./simple.css"), options.staticPrefix, plugin);

            addToggle(plugin);
            addTooltips();
            hideElements();
            hideGearIcon();
            setTitleFromTabs();
            updateFontSize();
            warnUnsaved();

            // get setting's version number
            var ver = settings.getNumber("user/cs50/simple/@ver");
            if (isNaN(ver) || ver < SETTINGS_VER) {
                // changes the vertical line to 132
                settings.set("user/ace/@printMarginColumn", "132");

                // set status bar to always show
                settings.set("user/ace/statusbar/@show", true);

                // update settings version
                settings.set("user/cs50/simple/@ver", SETTINGS_VER);

                // turn off auto-save by default
                settings.set("user/general/@autosave", false);

                // download project as ZIP files by default
                settings.set("user/general/@downloadFilesAs", "zip");

                // disable autocomplete (temporarily?)
                settings.set("user/language/@continuousCompletion", false);
                settings.set("user/language/@enterCompletion", false);

                // hide asterisks for unsaved documents
                settings.set("user/tabs/@asterisk", false);

                // default excluded formats
                var types = ["class", "exe", "gz", "o", "pdf", "pyc", "raw", "tar", "zip"];
                types.map(function(i) {
                    settings.set("user/tabs/editorTypes/@"+i, "none");
                });
            }

            settings.on("read", function() {
                settings.setDefaults("user/cs50/simple", [
                    ["gravatar", false],
                    ["lessComfortable", true],
                    ["terminalSound", true],
                    ["undeclaredVars", true]
                ]);
            });

            // when less comfortable option is changed
            settings.on("user/cs50/simple/@lessComfortable", function(saved) {
                if (saved !== lessComfortable) {
                    menus.click("View/Less Comfortable");
                }
            }, plugin);
            toggleSimpleMode(settings.get("user/cs50/simple/@lessComfortable"));

            // configure pylint's env
            if (!settings.getBool("project/cs50/simple/python/@configured")) {
                // prevent re-configuring if settings changed manually
                settings.set("project/cs50/simple/python/@configured", true);

                // set Python's version
                settings.set("project/python/@version", "python3");

                // set pylint's flags
                settings.set(
                    "project/python/@pylintFlags",
                    "-d all -e E -e F --generated-members=app.jinja_env.*"
                );

                // set PYTHONPATH
                settings.set(
                    "project/python/@path",
                    "/home/ubuntu/.local/lib/python3.4/site-packages" +
                    ":/usr/lib/python3/dist-packages" +
                    ":/usr/local/lib/python3.4/dist-packages"
                );
            }

            // add trailing line to text files upon saving (if enabled)
            addTrailingLine();

            // stop marking undeclared variables for javascript files
            tabManager.on("tabAfterActivate", toggleUndeclaredVars);

            // set titles of terminal tabs to current directory name
            tabManager.on("tabCreate", function(e) {
                setTmuxTitle(e.tab);
            }, plugin);

            // add terminal sound
            terminalSound = new Audio(options.staticPrefix + "/sounds/bell.mp3");
            toggleTerminalSound(settings.getBool("user/cs50/simple/@terminalSound"));
            settings.on("user/cs50/simple/@terminalSound", toggleTerminalSound, plugin);

            // determine whether we're presenting initially
            presenting = settings.getBool("user/cs50/presentation/@presenting");

            // update presenting when necessary
            settings.on("user/cs50/presentation/@presenting", function(val) {
                presenting = val;
            }, plugin);

            // add Gravatar toggle online only
            info.getUser(addGravatarToggle);

            // forcibly enable changes panel once
            if (!settings.getBool("project/cs50/simple/@scm-enabled")) {
                settings.set("state/experiments/@git", true);
                settings.set("project/cs50/simple/@scm-enabled", true);
            }

            // enable author info when workspace is shared only
            if (c9.hosted) {
                settings.setDefaults("user/cs50/simple/collab", [
                    // cache original author info setting
                    ["originAuthorInfo", settings.getBool("user/collab/@show-author-info")],

                    // automatically toggle author info by default
                    ["authorInfoToggled", true]
                ]);

                // update author info as setting is toggled
                settings.on("user/cs50/simple/collab/@authorInfoToggled", updateAuthorInfo);

                // update author info initially
                updateAuthorInfo(settings.getBool("user/cs50/simple/collab/@authorInfoToggled"));

                // cache original author info setting as it changes
                settings.on("user/collab/@show-author-info", function(val) {
                    // ensure only original setting is cached
                    if (authorInfoToggled === false)
                        settings.set("user/cs50/simple/collab/@originAuthorInfo", val);
                });

                // add preference toggle
                prefs.add({
                    "CS50" : {
                        position: 5,
                        "IDE Behavior" : {
                            position: 10,
                            "Automatically Toggle Author Info" : {
                                type: "checkbox",
                                setting: "user/cs50/simple/collab/@authorInfoToggled",
                                position: 900
                            }
                        }
                    }
                }, plugin);

                // load members in the workspace
                workspace.loadMembers(updateAuthorInfo);

                // update author info as members are added or removed
                workspace.on("sync", updateAuthorInfo);
            }
        }

        /***** Lifecycle *****/

        plugin.on("load", function() {
            load();
        });

        plugin.on("unload", function() {
            toggleSimpleMode(false);
            authorInfoToggled = null;
            avatar = null;
            divs = [];
            foldAvailFuncs = {};
            lessComfortable = false;
            presenting = false;
            terminalSound = null;
            trailingLine = null;
            loaded = false;
        });

        /***** Register and define API *****/

        /**
         * Left this empty since nobody else should be using our plugin
         **/
        plugin.freezePublicAPI({
            get lessComfortable() { return lessComfortable; },

            _events: [ "lessComfortable" ]
        });

        register(null, { "cs50.simple" : plugin });
    }
});
