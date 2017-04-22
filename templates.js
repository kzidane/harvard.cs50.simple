define(function(require, exports, module) {
    main.consumes = ["Plugin", "menus", "newresource"];
    main.provides = ["cs50.templates"];
    return main;

    function main(options, imports, register) {
        var menus = imports.menus;
        var newresource = imports.newresource;
        var Plugin = imports.Plugin;

        var plugin = new Plugin("CS50", main.consumes);

        function addTemplate(template, caption) {
            if (caption)
                menus.remove("File/New From Template/" + caption);

            newresource.addFileTemplate(template, plugin);

            // ensure templates are sorted
            sortTemplates();
        }

        function sortTemplates() {

            // sort template items and update their captions
            var templates = menus.get("File/New From Template").menu;
            if (!templates)
                return;

            var index = 100;
            templates.childNodes.map(function(item) {
                return item.getAttribute("caption");
            }).sort().forEach(function(caption) {

                // template path
                var path = "File/New From Template/" + caption;

                // template menu item
                var item = menus.get(path).item;

                // ensure item exists
                if (item) {
                    // remove " file" suffix
                    item.setAttribute("caption", caption.replace(/\sfile$/, ""));

                    // put item in correct position
                    menus.addItemByPath(path, menus.get(path).item, index += 100, plugin);
                }
            });
        }


        plugin.on("load", function() {
            // add and overwrite templates
            // require has to receive string literal because parsed not evaluated
            // add C template
            addTemplate(require("text!./templates/c.templates"));

            // overwrite default PHP template
            addTemplate(require("text!./templates/php.templates"), "PHP file");

            // overwrite default Python template
            addTemplate(require("text!./templates/python.templates"));

            // remove JavaScript template item
            menus.remove("File/New From Template/JavaScript file");

            // sort templates initially
            sortTemplates();
        });

        plugin.freezePublicAPI({});

        register(null, { "cs50.templates": plugin });
    }
});
