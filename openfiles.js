define(function(require, exports, module) {
    main.consumes = ["commands", "cs50.simple", "dialog.file", "menus", "Plugin", "tabManager"];
    main.provides = ["cs50.openfiles"];
    return main;

    function main(options, imports, register) {
        var commands = imports.commands;
        var fileDialog = imports["dialog.file"];
        var menus = imports.menus;
        var Plugin = imports.Plugin;
        var simple = imports["cs50.simple"];
        var tabs = imports.tabManager;

        var plugin = new Plugin("CS50", main.consumes);

        var opening = false;

        /**
         * Prevents selection of multiple files in "open file" dialog's tree
         */
        function selectNode() {
            var selection = fileDialog.tree.selection;
            var selectedNodes = selection.getSelectedNodes();

            if (selectedNodes.length > 1)
                // select last selected node only
                selection.selectNode(selectedNodes[selectedNodes.length - 1], false);
        }


        plugin.on("load", function() {

            // add command that opens file dialog in less-comfy only
            commands.addCommand({
                name: "openFileDialog",
                hint: "Opens file dialog for opening files",
                bindKey: commands.commands.navigate.bindKey,
                exec: function() {

                    // override in less-comfy only
                    if (!simple.lessComfortable)
                        return commands.exec("navigate");

                    // wehther to customize file dialog
                    opening = true;

                    // show "Open file" dialog
                    fileDialog.show("Open file", null, function(path) {

                        // hide file dialog
                        fileDialog.hide();

                        // open and activate file at path
                        tabs.openFile(path, true);
                    }, null, {
                        createFolderButton: false,
                        showFilesCheckbox: false,
                        chooseCaption: "Open"
                    });
                }
            }, plugin);

            // delete navigate's keyboard shortcut
            delete commands.commands.navigate.bindKey

            // customize file dialog
            fileDialog.on("show", function() {

                // avoid customizing other file dialogs (e.g., save)
                if (!opening)
                    return;

                // hide "Folder:" label and text field
                var txtDirectory = fileDialog.getElement("txtDirectory");
                txtDirectory.previousSibling.hide();
                txtDirectory.hide();

                // allow opening file by double-clicking it
                fileDialog.tree.once("afterChoose", function() {
                    fileDialog.getElement("btnChoose").dispatchEvent("click");
                });

                // disable multiple selection
                fileDialog.tree.on("changeSelection", selectNode);
            }, plugin);

            // clean up to avoid affecting other file dialogs
            fileDialog.on("hide", function() {

                // reset openingFile
                opening = false;

                // remove changeSelection listener
                fileDialog.tree.off("changeSelection", selectNode);
            }, plugin);

            // override "File/Open"'s behavior
            var openItem = menus.get("File/Open...").item;
            if (openItem)
                openItem.setAttribute("command", "openFileDialog");
        });

        plugin.freezePublicAPI({});

        register(null, { "cs50.openfiles": plugin });
    }
});
