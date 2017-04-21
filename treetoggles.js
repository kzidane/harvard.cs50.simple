define(function(require, exports, module) {
    main.consumes = ["cs50.utils", "Plugin", "layout", "menus", "panels", "settings", "tabManager", "tree", "ui"];
    main.provides = ["cs50.treetoggles"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var layout = imports.layout;
        var menus = imports.menus;
        var panels = imports.panels;
        var settings = imports.settings;
        var tabs = imports.tabManager;
        var tree = imports.tree;
        var ui = imports.ui;
        var utils = imports["cs50.utils"];

        var plugin = new Plugin("CS50", main.consumes);

        var button = null;
        var dark = null;
        var menuItem = null;
        var midCol = null;

        function addToggles() {

            // remove workspace from left bar
            panels.disablePanel("tree", false, true);

            // hide Window > Workspace
            utils.showMenuItem("Window/Workspace", false);

            // add View > File Browser
            menuItem = new ui.item({
                type: "check",
                caption: "File Browser",
                command: "toggletree"
            });
            menus.addItemByPath("View/File Browser", menuItem, 200, plugin);

            // handle pane creation
            tabs.on("paneCreate", function(e) {

                var panes = tabs.getPanes(midCol);

                // ensure created pane is not console
                var pane = panes.find(function(pane) {
                    return pane === e.pane;
                });

                if (!pane)
                    return;

                // create hidden toggle button
                var button = ui.button({
                    id: "treeToggle",
                    "class": "cs50-tree-toggle",
                    command: "toggletree",
                    skin: "c9-simple-btn",
                    height: 16,
                    width: 16,
                    visible: false
                });

                // add button to pane
                pane.aml.appendChild(button);

                // destroy button when pane destroyed
                pane.addElement(button);

                // show toggle in first pane
                if (tabs.getPanes().length === 1)
                    showToggle(panes[0]);
            }, plugin);

            // determine next pane to show button into
            tabs.on("paneDestroy", function(e) {

                // if not toggle pane
                if (button && button.pane !== e.pane)
                    return;

                var panes = tabs.getPanes(midCol);

                // ensure at least one pane left
                if (panes.length < 1)
                    return;

                var nextPane = panes[0];

                // pane boundaries
                var rect = nextPane.container.getBoundingClientRect();
                for (var i = 1; i < panes.length; i++) {
                    var currRect = panes[i].container.getBoundingClientRect();

                    // select if more top-left pane
                    if (currRect.left <= rect.left && currRect.top <= rect.top) {
                        rect = currRect;
                        nextPane = panes[i];
                    }
                }

                showToggle(nextPane);
            }, plugin);
        }

        function showToggle(pane) {

            pane.getElement("treeToggle", function(b) {

                // make room for button
                pane.aml.$ext.classList.add("cs50-tree-toggle-pane0");
                pane.aml.$buttons.style.paddingLeft = "54px";

                // show button only if tabs are visible
                b.setAttribute("visible", settings.getBool("user/tabs/@show"));

                // remember container pane
                b.pane = pane;

                // remember currently visible button
                button = b;

                // sync button style with tree visibility
                sync(tree.active);
            });
        }

        function sync(active) {
            if (!button || !menuItem)
                return;

            var style = "cs50-tree-toggle";

            if (dark)
                style += " dark";

            if (active) {
                style += " active"
                menuItem.setAttribute("checked", true);
            }
            else {
                menuItem.setAttribute("checked", false);
            }

            button.setAttribute("class", style);
        }

        plugin.on("load", function() {
            ui.insertCss(require("text!./treetoggles.css"), options.staticPrefix, plugin);

            // initial skin
            dark = settings.get("user/general/@skin").indexOf("dark") > -1;
            settings.on("user/general/@skin", function(skin) {
                dark = skin.indexOf("dark") > -1;
                sync(tree.active);
            }, plugin);

            // middle column
            midCol = layout.findParent(tabs);

            addToggles();

            // sync tree toggles
            tree.once("draw", sync.bind(null, true), plugin);
            tree.on("show", sync.bind(null, true), plugin);
            tree.on("hide", sync, plugin);

            // toggle visibility of tree toggle as tabs are shown or hidden
            settings.on("user/tabs/@show", function(visible) {
                button.setAttribute("visible", visible);
            }, plugin);
        });

        plugin.on("unload", function() {
            button = dark = menuItem = midCol = null;
        });

        // define plugin's API
        plugin.freezePublicAPI({});

        // register plugin
        register(null, { "cs50.treetoggles": plugin });
    }
});
