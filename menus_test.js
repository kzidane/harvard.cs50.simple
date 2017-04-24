"use client";
"use mocha";

define(function(require, exports, module) {
    main.consumes = ["plugin.test"];
    main.provides = [];
    return main;

    function main(options, imports, register) {
        var test = imports["plugin.test"];

        var describe = test.describe;
        var it = test.it;
        var assert = test.assert;

        describe(myplugin.name, function(){
            this.timeout(2000);

            // "Go To Your Dashboard" to "Dashboard"
            it("Go To Your Dashboard to Dashboard", function() {
                assert.deepStrictEqual(menus.get("Cloud9/Go To Your Dashboard").item.caption, "Dashboard");
            });
            // "Dashboard" before "Preferences"
            // "Account" removed from user menu
            // "Account" moved to "CS50 IDE" menu
            // "Dashboard", "Home", and "Log out" removed from user menu
            // "Restart Wokrspace" to "Restart"
            // "Dashboard" and "Log out" removed offline
            // "About CS50" added
            // "What's new?" added
            // div before "About Cloud9" added
            // div after "Preferences" added
            // div after "Preferences" shows after toggling less-comfy
            // "Restart Cloud9" hidden
            // Window > Collaborate hidden offline
            // Run hidden
            // Menu items are toggled
            // Captions are updated
        });

        register(null, {});
    }
});
