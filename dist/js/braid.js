import autoBind from "./autobind.js";
let ranks = {
    default: -1, //output only
    braid: 1,
    free: 0,
    foundation: -2, //I think this might be redundant but ok
}
function DEBUG(text) {
    if(false) {
        console.debug(text);
    }
}
let $root;

let Prefs = new class {
    constructor() {
        this.left = false;
        this.auto = false;
        this.rules = true;
        this.load();
        this.name = "maumee";
    }
    async load() {
        let num;
        num=Cookies.get(this.name);
        if(num===undefined) {num=1;} else {num=Number(num);}
        this.left = Boolean(num&4);
        this.auto = Boolean(num&2);
        this.rules = Boolean(num&1);
    }
    save() {
        let code = (this.left<<2) + (this.auto<<1) + (this.rules<<0);
        Cookies.set(this.name,code);
    }
    toggle(which) {
        this[which] = !this[which];
        this.save();
    }
}


let automatic = false;
let showrules = true;

let foundation = {};
let talon;
let discard;
let Ndocks=5;
let Nbraid=19;
let Nfree = 8;
let Ndecks = 2;
let docks = [];
let free = [];

let suits = {"H":"&#9829;",//&hearts;",
             "D":"&#9830;",//&diams;",
             "S":"&#9824;",//&spades;",
             "C":"C",//&clubs;"
};
const getSuit = (suit)=>{
    return `<img class="suit" src="assets/suits/${suit}.png">`;
    return suits[suit];
//    return '<svg width="60" height="60" xmlns="http://www.w3.org/2000/svg">'+suits[suit]+"</svg>";
}
let colors = {"H": "red",
              "D": "#A00",
              "S": "black",
              "C": "#00A"};
let values = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
let sources = [];
let targets = [];
let piles = [];
let mycards = [];
let braid;
function randint(start,eww) {//a number start, start+1, ..., eww-1
    if (eww==undefined) {
        eww = start;
        start=0;
    }
    return Math.floor((eww-start)*Math.random())+start;
}
//------------------------------------------------------------
function adjustPositions() {
    let canvas = $("#canvas")[0].getBoundingClientRect();
    $(".card.bottom").toggle(canvas.height>canvas.width);
    for (let card of mycards) {
        if (card.pile instanceof Braid) {
            braid.flow();
        } else {
            card.adjustPosition();
        }
    }
}
//========================================
let Undo = new class {
    constructor() {
        this.stack = [];
        this.rstack = [];
        this.add = this.add.bind(this);
        this.undo = this.undo.bind(this);
        this.active = false;
    }
    reset() {
        this.stack = [];
        this.rstack = [];
        this.active = false;
    }
    setbuttons() {
        $("#undo").toggleClass("empty", this.stack.length==0);
        $("#redo").toggleClass("empty",  this.rstack.length==0);
    }
    add(source,target,braidQ=false) {
        //dir is the direction of the foundation: -1,0,1
        braidQ = (source instanceof Dock);
        this.stack.push([source,target,braidQ]); //braidQ if the undo involves moving a card from source back to the braid
        this.rstack= [];
        this.setbuttons();
        /*this.output();*/
    }
    output() {
        let result=[];
        for (let item of this.stack) {
            result.push(item[0].name+"->"+item[1].name);
        }
    }
    undo() {
        if (this.stack.length==0) {return;}
        this.active=true;
        let [source,target,braidQ] = this.stack.pop();
        if (target=="flip") {
            source.unflip();
        } else {
            if(braidQ) {
                braid.add(source.remove());
            }
            source.add(target.remove());
            SetDirection();
        }
        this.rstack.push([source,target,braidQ]);
        this.setbuttons();
        this.active=false;
    }
    redo() {
        if (this.rstack.length==0) {return;}
        this.active=true;
        let [source,target,braidQ] = this.rstack.pop();
        if (target == "flip") {
            source.flip();
        } else {
            target.add(source.remove());
            if (source instanceof Dock) {
                source.add(braid.remove());
            }
        }
        this.stack.push([source,target]);
        SetDirection();
        this.setbuttons();
        this.active=false;
    }
}
//========================================
let selection = new class {
    constructor() {
        this.$root = $("body");
        this.clear();
        this.shift = {x:0,y:0};
        autoBind(this);
    }
    clear() {
        this.card= null; //the card that is currently being dragged
        this.moved= false; //whether the mouse has moved or not
        this.source= null; //the pile that the card came from
        this.target= null; //the pile that is currently being targeted
        this.unhighlight();
    }
    unhighlight() {
        $(".highlight").removeClass("highlight");
    }
    reject() {//replaces card.returntopile
        if (this.card==null) {return;}
        this.source.add(this.card);
        this.clear();
    }
    dragstart(pile,e) {
        Interact();
        this.card = pile.remove();
        let duh = this.card.$w[0].getBoundingClientRect();
        let co = GetCoords(e);
        this.startco = co;
        this.shift = {x:duh.left - co.x, y:duh.top - co.y};
        this.card.$w.addClass("dragging");
        this.source = pile;
    }
    dragend(e) {//UI
        if(!this.card) {return "";}
        this.card.$w.removeClass("dragging");
        let co = GetCoords(e);
        let dist = Math.hypot(co.x-this.startco.x,co.y-this.startco.y);
        if ( dist < 10) {
            let source = this.source;
            this.reject();
            source.click(source);
            return "click";
        }

        if(!this.moved) {
            if (! MoveToFoundation(this.source,this.card)) {
                this.source.add(this.card);//restore to the original pile
            }
        } else if (this.target && this.target.ok(this.card)) {
            this.target.add(this.card);
            Undo.add(this.source,this.target);
        } else {
            this.reject();
        }
        this.clear();
        IsDone();
        e.preventDefault();
        console.debug("dragend");
        return "";
    }
    dragmove(e,buttondown) {
        this.moved = true;
        let co = GetCoords(e);
        if (buttondown && this.card) {
            this.card.move(co.x + this.shift.x,
                           co.y + this.shift.y);
        }
        this.target = null;
        for (let p of targets) {
            if (p.insideQ(co.x,co.y)) {
                this.target = p;
                p.hoverIn();
            } else {
                p.hoverOut();
            }
        }
    }
};

function GetCoords(e) {
    let ct = e.changedTouches;
    if (ct) {
        return {x:ct[0].pageX,y:ct[0].pageY};
    } else {
        return {x:e.pageX, y:e.pageY};
    }
}

function coords(x,y) {
    //convert from points to vw/vh
    let canvas = $("#canvas")[0].getBoundingClientRect();
    return {left: (x/canvas.width*100)+"vw",
            top:  (y/canvas.height*100)+"vh"};
}
//========================================
class Card {
    constructor($root,suit,value) {
        this.$root = $root;
        this.suit = suit;
        this.value = value;
        let text = value+getSuit(suit);
        this.$w = $("<div>")
            .addClass("card")
            .addClass(`card${value}${suit}`);
        let span = $("<span>")
            .html(text) /*+"<p class=bottom>"+text+"</p>")*/
            .css({"color":colors[this.suit],
                 })
            .appendTo(this.$w);
        this.x=-100; this.y=-100;
        this.move(-100,-100);
        //QUESTION: 
        this.$w.appendTo(this.$root);
        autoBind(this);

    }
    pileName() {
        return this.pile.constructor.name;
    }
    adjustPosition() {
        if (this.pile) {
            let R = this.pile.pos();
            this.$w.css(coords(R[0],R[1]));
        }
    }
    move(x,y) {
        this.$w.css(
            coords(x,y)
        );
        this.x = x; this.y = y;
    }
    str() {
        return this.value + this.suit;
    }
    destroy() {
        this.$w.remove();
    }
}
function makedeck() {
    let cards = [];
    for (let n = 1; n<=Ndecks; n++) {
        for (let suit of Object.keys(suits)) {
            for (let val of values) {
                let pos = randint(0,cards.length+1); //because you can insert cards at the end too
                cards.splice(pos, 0, new Card($root,suit,val)); //inserts randomly
            }
        }
    }
    //last card always seems to be the same, bleh
//    let card1 = cards.splice(-1,1)[0];
//    let pos = randint(0,cards.length);
    //    cards.splice(pos,0,card1);
    mycards = [...cards];
    return cards;
}
function FindCards(value,suit) {
    let found = mycards.filter((card)=>card.value==value && card.suit==suit);
    return [found[0],found[1]];
}
//========================================
class Pile {
    constructor($root,x,y,createQ=true) {
        this.x = x;
        this.y = y;
        this.rank = ranks.default; //for use by automoves
        this.label = piles.length;
        this.$root = $root;
        if(createQ) {
            this.$w = $("<div>").addClass("pile")
                .css({top: y, left: x}).appendTo($root);
        } else {
            this.$w = this.$root;
        }
        this.$w.addClass("pile");
        this.$overlay = $("<div>")
            .addClass("overlay")
            .appendTo(this.$w);
        this.stack = [];
        piles.push(this);
        autoBind(this);
    }
    reset() {
        this.stack = [];
    }
    insideQ(x,y) {
        let R = this.$w[0].getBoundingClientRect();
        return (x>=R.left && x<=R.right && y>=R.top && y<=R.bottom);
    }
    ok(card) {
        return false; //extensible
        //return this.stack.length==0;
    }
    hoverIn(e) {
        //this.$w.addClass("hover"); //extensible
    }
    hoverOut(e) {
        //this.$w.removeClass("hover"); //extensible
    }
    pos(i) {
        //position of the ith card in the pile, extensible for Braid
        let R = this.$w[0].getBoundingClientRect();
        let margin =0; //0*parseFloat($(this.$w[0]).css("margin-left"));
        return [R.left-margin,R.top-margin];
    }
    update() {
    }
    add(card) {
        if(!card) {return;}
        this.stack.push(card);
        let n = this.stack.length;
        card.$w.css({"z-index":100 + n});
        card.pile = this;
        card.move(...this.pos(n));
        this.update();
    }
    remove() {
        let card = this.stack.pop();
        this.update();
        return card;
    }
    top() {
        if (this.empty()) {return null;}
        return this.stack[this.stack.length-1];
    }
    empty() {
        return this.stack.length==0;
    }
}
//========================================
class Talon extends Pile {
    constructor($root,target,cards) {
        super($root,0,0);
        this.$count = $("#taloncount");
        this.$flipcount = $("<span>").appendTo(this.$overlay);
        this.$w.addClass("talon");
        if(cards) {
            for(let card of cards) {
                this.add(card);
            }
        }
        this.$overlay.on("click",() => {//UI
            Interact();
            if(this.flip()) {
                Undo.add(this,"flip");
            }
            AutoPlay(false,"wait");
        }
                        );
        this.times=1;
        this.target = target;
        autoBind(this);
    }
    reset() {
        super.reset();
        this.times = 1;
    }
    update() {
        this.$count.html(this.stack.length);
        this.$flipcount.html(this.times);
        this.$overlay.toggleClass("empty",this.stack.length==0);
        this.$overlay.css("background-image",`url(assets/img/cardback${Math.min(4,this.times)}.png)`);
    }
    flip() {
        selection.unhighlight();
        if (this.empty()){
            while (!this.target.empty()){
                this.add(this.target.remove());
            }
            this.times++;
            this.update();
        } else {
            this.target.add(this.remove());
        }
        this.$overlay.toggleClass("empty",this.empty());
        IsDone();
        console.debug("flip");
        return true;
    }
    unflip() {
        selection.unhighlight();
        if (this.target.empty()) {
            while (!this.empty()) {
                this.target.add(this.remove());
            }
            this.times--;
            this.update();
        } else {
            this.add(this.target.remove());
        }
        this.$overlay.toggleClass("empty",this.empty());
        IsDone();
        console.debug("unflip");
        return true;
    }
}

class Braid extends Pile {
    constructor($root,x,y){
        super($root,x,y,false);
        this.$w.addClass("braid");
        this.$overlay.remove();
        this.rank = ranks.braid;
    }
    reset() {
        super.reset();
    }
    add(card) {
        if(card==undefined) {return;}
        super.add(card);
        card.$w.addClass("braidcard");
        for(let c of this.stack) {
            if (card.suit == c.suit && card.value == c.value && c!=card) {
                card.$w.addClass("duplicates");
                c.$w.addClass("duplicates");
            }
        }
        this.flow();
    }
    output() {
        let result = [];
        for (let i of this.stack) {
            result.push(i.str());
        }
    }
    remove() {
        let debug;
        try {var a={}; a.debug();} catch(ex) {debug=ex.stack.split("\n");}
        let card = super.remove();
        if(card) {
            card.$w.removeClass("braidcard");
        }
        this.flow();
        return card;
    }
    contains(card,checkdock=false) {
        for(let i of this.stack) {
            if (card.value == i.value && card.suit == i.suit) {return true;}
        }
        if (checkdock) {
            for (let pile of docks) {
                let dock = docks.top();
                if (dock && dock.value == card.value && dock.suit==card.suit) {return true;}
            }
        }
        return false;
    }
    alignment(i) {
        return this.pos(i)[2];
    }
    restock() {
        console.debug(">restock");
        let moved = false;
        for (let pile of docks) {
            if (this.empty()) {break;}
            if (pile.empty()) {
                pile.add(this.remove());
                moved = true;
            }
        }
        if(moved) {AutoPlay(false,true);}
        console.debug("restock");
    }
    flow() {
        let N = this.stack.length;
        for (let i=0; i<N; i++) {
            this.stack[i].move(...this.pos(i+(20-N)));
        }
    }
    pos(i) {
        //x ranges from 0 to 3
        //y ranges from 0 to 6
        let x,y,align;
        if (i===0)      {x=0;                 y=4;    align="bottom";}
        else if (i<=3)  {x=0.5+0.04*(i-2);    y=4-i;  align="bottom";}
        else if (i==4)  {x=1;                 y=0;    align="";   }
        else if (i<=8)  {x=1.5 + 0.04*(i-6);  y=i-4;  align="top";}
        else if (i==9)  {x=2;                 y=5;    align="";}
        else if (i<=13) {x=2.5 + 0.04*(i-11); y=14-i; align="bottom";}
        else if (i==14) {x=3;                 y=0;    align="top";}
        else {x=3.5+0.04*(i-17);                y=i-14;  align="top";}
        let braidbox = $("#braid")[0].getBoundingClientRect();
        let X = (braidbox.left + x * 0.20*braidbox.width);
/*        if (Prefs.left) {
            X = braidbox.right - x * 0.20*braidbox.width;
        }*/
        let L = [
            X,
            (braidbox.top  + y * 0.14*braidbox.height),
            align];
        return L;
    };
}
class DragOut extends Pile {
    constructor($root,x,y) {
        super($root,x,y);
        if (!(this instanceof Foundation)) {
            sources.push(this);
        }
        this.$overlay.on("click",(e,pile=this)=>{this.click(pile);});
        this.$overlay.on("mousemove",(e,pile=this)=>{
            if(e.buttons && !selection.card) {selection.dragstart(pile,e);}
        });
        this.$overlay.on("touchstart",(e,pile=this)=>{
            selection.dragstart(pile,e);
            e.preventDefault();
        });
        this.$overlay.on("touchend",(e)=>{
            selection.dragend(e);
        });
    }
    click(pile) {
            Interact();
            let result = MoveToFoundation(pile,pile.top());
            if (result) {
                pile.remove();
                IsDone();
            }
        return result;
    }
    highlight() {
        this.$w.addClass("highlight");
        $("#available").addClass("highlight");
    }
}
function AutoPlay(always,after) {
    if (Prefs.auto || always) {
        if(after) {
            setTimeout(GetAvailable,200);
        } else {
            GetAvailable();
        }
    }
}
function GetAvailable() {//UI
    /*
      For each available card, determine whether it could be placed on the foundation.
      If the card is a root card, move it.
      If the direction has not been determined, highlight but do not move.
      If the available card does not exist in the braid, go ahead and move it.
      Otherwise highlight it somehow.
    */
    let movedFlag = false;
    for (let pile of sources) {
        let card = pile.top();
        if(card) {
            for(let key of foundation.keys) {
                let label = card.str()+"->"+key;
                let target = foundation[key];
                if (target.ok(card,true)) {//this card could be placed on the thingy
                    let move = false;
                    //if its a base foundation card, play it right away
                    if(card.value == foundation.value) {
                        move=true;
                    }
                    else if (foundation.direction) {
                        let found = FindCards(card.value,card.suit);
                        if (foundation[target.sib].ok(card,true)) {//matches BOTH foundation spots
                            move=true;
                        } else {
                            //rank is a measure of the priority a card has in its current position, defined in ranks
                            //it is NOT the number on the card
                            //if there exists a card with a higher rank than this one, then don't move this one
                            move = (card.pile.rank >= Math.max(found[0].pile.rank, found[1].pile.rank));
                        }
                    }
                    if(move) {
                        Undo.add(pile,target);
                        target.add(card);
                        pile.remove();
                        movedFlag = true;
                    } else {pile.highlight();}
                    break;
                }
            }
        }
    }
    if(movedFlag) {AutoPlay("always","wait");}
    else {IsDone();}
    console.debug("GetAvailable");
}
class Discard extends DragOut {
    constructor($root) {
        super($root,0,0);
        this.$w.attr("id","discard");
        this.$overlay.html("Discard");
        this.$count = $("#discardcount");
    }
    update() {
        this.$count.html(this.stack.length);
    }
    click(pile) {
        console.debug("Discard>click");
        if (!super.click(pile)) {
            for (let tgt of free) {
                if (tgt.ok()) {
                    tgt.add(pile.remove());
                    Undo.add(pile,tgt);
                    IsDone();
                    return true;
                }
            }
            for (let tgt of docks) {
                if (tgt.ok()) {
                    tgt.add(pile.remove());
                    Undo.add(pile,tgt);
                    IsDone();
                    return true;
                }
            }
            return false;
        }
        return true;
    }
}
class DragIn extends DragOut {
    constructor($root,x,y) {
        super($root,x,y);
        targets.push(this);
        autoBind(this);
    }
    ok(card) {
        return this.empty();
    }
    hoverIn() {
        if(selection.card) {
            this.$w.addClass("hover");
        }
    }
    hoverOut() {
        this.$w.removeClass("hover");
    }
}
class Free extends DragIn {
    constructor($root) {
        super($root,0,0);
        this.rank = ranks.free;
    }
    ok (card) {
        return (super.ok(card) && !(selection.source instanceof Dock));
    }

}
//========================================
class Dock extends DragIn {
    constructor($root,braid) {
        super($root,0,0);
        this.braid = braid;
        this.rank = ranks.braid;
    }
    add(card) {
        super.add(card);
        this.callback();
    }
    remove() {
        let card = super.remove();
        this.callback();
        return card;
    }
    callback() {
        if (this.stack.length==2) {
            this.braid.add(this.stack.shift());
        }
        console.debug("Dock.callback")
    }
}

foundation.direction = 0;

function MoveToFoundation(pile,card) {//UI
    console.debug(">MoveToFoundation")
    let move = false;
    if(card) {
        for(let key of foundation.keys) {
            let label = card.str()+"->"+key;
            let target = foundation[key];
            if (target.ok(card,true)) {
                Undo.add(pile,target);
                target.ok(card);
                target.add(card);
                console.debug("MoveToFoundation true");
                AutoPlay(false,true);
                return true;
            }
        }
    }
    return false;
}
function Compare(a,b) {
    if (!a || !b) {return 0;}
    a = values.indexOf(a.value);
    b = values.indexOf(b.value);
    let N = values.length;
    if (a==b) {return 0;}
    let V = a - b;
    let result = 0;
    if ((V+N+1)%N == 0) {result = 1;}
    else if ((V+N-1)%N == 0) {result = -1;}
    return result;
}
function GetDirection() {
    for (let key of foundation.keys) {
        let dir = foundation[key].getDir();
        if (dir!=0) {return dir;}
    }
    return 0;
}
function SetDirection() {
    let dir = GetDirection();
    foundation.direction = dir;
    foundation.$arrow
        .toggleClass("up",dir>0)
        .toggleClass("down",dir<0);
}
//========================================
class Foundation extends DragIn {
    constructor($root,suit,start) {
        super($root,0,0);
        this.rank = ranks.foundation; 
        this.$w.addClass("foundation");
        this.$display = $("<span>").appendTo(this.$w);
        this.$display.html(start+getSuit(suit));
        this.suit = suit;
        this.start = start;
        this.$overlay.on("mousedown",this.highlightNext);
        this.$overlay.appendTo(this.$w);
    }
    full() {
        let isfull = this.stack.length == values.length;
        this.$overlay.toggleClass("done",isfull);
        return isfull;
    }
    reset(start) {
        super.reset();
        $(".card").removeClass("root");
        if (start) {
            this.start = start;
            this.$display.html(this.start+getSuit(this.suit));
            for(let suit of Object.keys(suits)) {
                $(`.card${this.start}${suit}`).addClass("root");
            }
            
        } else {
            this.$display.html("");
        }
    }
    highlightNext() {
        for(let pile of sources) {
            if (this.ok(pile.top(),true)) {
                pile.highlight();
            }
        }
    }
    getDir(){
        return Compare(this.stack[0], this.stack[1]);
    }
    
    ok(card) {
        DEBUG(`CHECKING CARD ${card.str()}`);
        if (!card) {DEBUG("no card");return false;}
        //reject if the suits don't match
        if (card.suit!=this.suit){
            DEBUG(`suit doesn't match: ${card.suit} != ${this.suit}`);
            return false;
        }
        //reject if this foundation is full
        if (this.full()) {
            return false;
        }
        //if foundation is empty, only base cards can be played here
        if (this.stack.length==0) {
            DEBUG(`stack is empty: ${card.value}, ${this.start}`);
            return card.value == this.start;
        }
        let a = values.indexOf(this.top().value);
        let b = values.indexOf(card.value);
        let dir = Compare(this.top(), card); //is this card adjacent to the foundation top?
        //reject if it isn't adjacent
        if (dir==0) {return false;}
        //accept if it is going in the right direction
        if (dir*foundation.direction==1) {return true;}
        //if a direction hasn't been chosen, then it's ok either way
        if(foundation.direction == 0) {return true;}
        return false;
    }
    add(source, target) {
        super.add(source,target);
        this.full();
    }
    remove() {
        let result = super.remove();
        this.full();
        return result;
    }
}
function CheckWin() {
    let total = 0;
    let result = true;
    for (let key of foundation.keys) {
        let isFull = foundation[key].full();
        result = result && isFull;
    }
    if(result) {console.log("WINNER");
                $("#win").addClass("win");
               }
}
function Interact() {
    //called anytime the player interacts with the field
    selection.unhighlight();
}
function IsDone() {
    braid.restock();
    CheckWin();
    adjustPositions();
    SetDirection();
    talon.update();
    discard.update();
    Undo.setbuttons();
}
function Setup(cards) {
    //BRAID
    for (let i=0; i<Nbraid; i++) {
        braid.add(cards.pop());
        let card = braid.top();
        card.align = braid.alignment(braid.stack.length);
        if (card.align) {
            card.$w.addClass("align"+card.align);
        }
    }
    //DOCKS
    for (let i=0; i<Ndocks; i++) {
        docks[i].add(cards.pop());
    }
    //FREE
    for (let pile of free) {
        pile.add(cards.pop());
    }
    let card = cards.pop();
    foundation.value = card.value;
    for (let key of foundation.keys) {
        foundation[key].reset(card.value);
    }
    foundation[card.suit+"0"].add(card);

    //FIX: change labels on piles
    for (card of cards) {
        talon.add(card);
    }
    IsDone();
}

function Reset() {
    $(".card").removeClass("root");
    braid.reset();
    for (let i=0; i<Ndocks; i++) {docks[i].reset();}
    for (let pile of free) {pile.reset();}
    for (let key of foundation.keys) {
        foundation[key].reset();
    }
    foundation.direction = 0;
    talon.reset();
    discard.reset();
    Undo.reset();
    $("#win").removeClass("win");
}
let dialog = new class Dialog {
    constructor() {
        autoBind(this);
        this.$w = $("<dialog>").appendTo("body")
        this.$text = $("<div>").appendTo(this.$w);
        this.$ok = $("<button id=ok>").html("OK")
            .appendTo(this.$w)
            .on("click",this.ok);
        this.$cancel = $("<button id=cancel>").html("Cancel")
            .appendTo(this.$w)
            .on("click",this.close);
    }
    show(message,callback) {
        this.fn = callback;
        this.$text.html(message);
        this.$w[0].showModal();
    }
    ok() {
        console.debug("ok");
        if(this.fn) {
            this.fn();
        }
        this.close();
    }
    close() {
        this.$w[0].close();
    }
}
function AskNewGame() {
    dialog.show("Start a new game?",NewGame);
}
function NewGame() {
    Reset();
    for (let card of mycards) {card.destroy();}
    let cards = makedeck($root);
    Setup(cards);
}
function AskRestart() {
    dialog.show("Restart this game?",Restart);
}
function Restart() {
    Reset();
    let cards = [...mycards];
    Setup(cards);
}
function Reverse() {
    $("body").toggleClass("reverse",Prefs.left);
    adjustPositions();
}
function init() {
    $root = $("#canvas");
    $(window).on("resize",IsDone);
    let Width = $root.width();
    $root.on("mouseup",selection.dragend);//UI
    $root.on("touchend",selection.dragend);//UI
    $root.on("mousemove",(e)=>{selection.dragmove(e,e.buttons)});
    $root.on("touchmove",(e)=>{
        selection.dragmove(e,true);
    });
    //BRAID--------------------
    braid = new Braid($("#braid"));
    braid.name = "@B";
    //DOCKS
    for(let i=0; i<Ndocks; i++) {
        docks[i] = new Dock($("#dock"),braid);
        docks[i].name = "@D"+(i+1);
    }
    //FREE--------------------
    for (let row = 0; row<2; row++) {
        for (let col=0; col<Nfree; col+=2) {
            let pile = new Free($("#free"));
            pile.name= "@Fr"+(row+1)+(col+1);
            free.push(pile);
        }   
    }
    //FOUNDATION--------------------
    foundation.$arrow = $("#direction");
    foundation.keys = [];
    for (let suit of Object.keys(suits)) {
        for (let col=0; col<Ndecks; col++) {
            let key = suit+col;
            foundation[key] = new Foundation($("#foundations"), suit, foundation.value);
            foundation[key].name = "@F"+suit+(col+1);
            foundation[key].sib = suit+(1-col);
            foundation.keys.push(key);
        }
    }
    //TALON--------------------
    let $talon = $("#talonbox");
    discard = new Discard($talon);
    discard.name = "@Dd";
    talon = new Talon($talon,discard);
    talon.name = "@T";

    //DEAL CARDS----------------------------------------
    let cards = makedeck($root);
    Setup(cards);
    //BUTTONS--------------------
    let $avail = $("#available").on("click",(e)=>{
        Interact();
        AutoPlay("always",false);
    });//UI
    $avail.on("dblclick",(e)=>{
        Prefs.toggle("auto");
        $("#available").toggleClass("automatic",Prefs.auto);
        
    });
    let $undo = $("#undo").on("click",(e)=>{Interact();Undo.undo(e)});
    let $redo = $("#redo").on("click",(e)=>{Interact();Undo.redo()});
    let $newgame = $("#newgame").on("click",AskNewGame);
    $("#win").on("click",()=>NewGame);
    let $restart = $("#restart").on("click",AskRestart);
    let $reverse = $("#reverse").on("click",(e) => {
        Prefs.toggle("left"); Reverse();
    });
    IsDone();
    $("#help").on("click",()=>{$("#popup").toggle();});
    $("#popup").on("click",()=>{$("#popup").toggle();});
    if(Prefs.rules) {
        $("#popup").show();
        Prefs.toggle("rules");
    }
    $("#available").toggleClass("automatic",Prefs.auto);
    AutoPlay(false,"wait");
    if(Prefs.left) {Reverse();}
    $("body").toggleClass("left",Prefs.left);
    console.log("=====READY=====");
    
}

$(init)
