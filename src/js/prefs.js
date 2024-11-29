import {Preferences} from "@capacitor/preferences";
//let Preferences = require("@capacitor/preferences");
//import {Cookies} from "./js/js-cookie.js";
export let Prefs = new class {
    constructor() {
        this.left = false;
        this.auto = false;
        this.rules = true;
        this.name = "maumee";
    }
    async load() {
        let num;
        let text="";
        if(Preferences) {
            num = await Preferences.get({key:this.name});
            text += "-P";
            document.querySelector("#canvas").style.backgroundColor = "#040";
        } else {
            document.querySelector("#canvas").style.backgroundColor = "#044";
            num=Cookies.get(this.name);
            text += "-C";
        }
        if(num===undefined) {num=1;} else {num=Number(num.value);}
        $("#prefDEBUG").html(text+num);
        this.left = Boolean(num&4);
        this.auto = Boolean(num&2);
        this.rules = Boolean(num&1);
    }
    async save() {
        let code = (this.left<<2) + (this.auto<<1) + (this.rules<<0);
        if(Preferences) {
            await Preferences.set({key:this.name, value:code});
            $("#prefDEBUG").html("*P"+code);
        } else {
            Cookies.set(this.name,code);
            $("#prefDEBUG").html("*C"+code);
        }
    }
    toggle(which) {
        this[which] = !this[which];
        this.save();
    }
}

