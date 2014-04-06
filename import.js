"use strict";
var debug = Boolean(getArgument());
//ajout d'une fonction average au prototype Array
Array.prototype.average = function () {
    var sum = 0, j = 0; 
    for (var i = 0; i < this.length, isFinite(this[i]); i++) { 
          sum += parseFloat(this[i]); ++j; 
    } 
   return j ? sum / j : 0; 
};

//Ouverture de l'image
var imp = IJ.openImage("frames/frames.tif");
imp.show();
//Traitements
IJ.setMinAndMax(imp, 126, 128);
IJ.run(imp, "Apply LUT", "stack");
IJ.run(imp, "8-bit", "");
IJ.run(imp, "Make Binary", "method=Otsu background=Dark calculate");
IJ.run(imp, "Flip Horizontally", "stack");

//Mesures, isolation des artéfacts,
IJ.run("Set Measurements...", "area centroid center stack redirect=None decimal=3");
var mean    = 0,
    SD      = 1,
    table, areas;
while(SD > mean / 4) {
    IJ.run(imp, "Analyze Particles...", "size=" + parseInt(mean/2) + "-Infinity clear stack");
    IJ.run("Summarize", "");
    table = ResultsTable.getResultsTable();
    areas = table.getColumn(table.getColumnIndex("Area"));
    mean  = areas[areas.length-4];
    IJ.log(mean);
    SD = areas[areas.length-3];
    IJ.log(SD);
}

var slices = table.getColumn(table.getColumnIndex("Slice"));
var slicesTotal=slices[slices.length-1] - slices[slices.length-2];
var resObscurite = parseInt((slicesTotal - slices.length - 4) / slicesTotal * 30);
var resParticule = 30 - resObscurite;

var subSlices = [];
var processingSubSlice;
for (var i = 0; i < slices.length - 5; i++) {
    //Si on est sur une possible lettre
    if (processingSubSlice) {
        //Si la particule suivante est trop loin
        if (slices[i] + resObscurite < slices[i + 1]) {
            //On enregistre l'index de fin et on sort de la lettre
            subSlices[subSlices.length - 1].end = i;
            processingSubSlice = false;
        }
    //Si on n'est pas sur une possible lettre
    } else {
        //Si la particule suivante est assez proche
        if (slices[i] + resObscurite >= slices[i + 1]) {
            //On commence une nouvelle lettre
            subSlices.push({start: i, end: null});
            processingSubSlice = true;
        }
    }
}
//Éventuellement termine la dernière lettre
subSlices[subSlices.length - 1].end = subSlices[subSlices.length - 1].end || i;//vrai que si .length est null
//garde seulement les formes assez longues
subSlices = subSlices.filter(function(sub) {
    return slices[sub.end] - slices[sub.start] > resParticule;
});

if (debug) {
    subSlices.forEach(function(sub, i) {
        IJ.log("Lettre " + (i + 1) + " de slice " + slices[sub.start] + " à " + slices[sub.end]);
    });
}

if (debug) {imp.show();}

var xArrayAll=table.getColumn(table.getColumnIndex("x"));
var yArrayAll=table.getColumn(table.getColumnIndex("y"));

//fonction calculant les angles et prenant en compte les décélérations
var processCoords = function(aSubSlice) {
    var xArray=xArrayAll.slice(aSubSlice.start,aSubSlice.end+1);
    var yArray=yArrayAll.slice(aSubSlice.start,aSubSlice.end+1);
    if (debug) IJ.log("Process coordinates from letter beginning at slice : "+aSubSlice.start+".");
    if (debug) IJ.log("Calculating speeds...");
    var speeds = new Array(xArray.length - 2);
    for (var i = 0; i < speeds.length; i++) {
        speeds[i] = Math.sqrt(
            Math.pow(xArray[i + 2] - xArray[i], 2) +
            Math.pow(yArray[i + 2] - yArray[i], 2)
        );
    }
    if (debug) IJ.log(speeds);
    if (debug) IJ.log("Finding all stops...");
    //calcul de MIN_SPEED
    var MIN_SPEED=speeds.average()/2;
    if (debug) IJ.log("Considerate stop if speed <"+MIN_SPEED+".");
    var indicesStop = [];
    speeds.forEach(function(e, i) {
        if (e < MIN_SPEED) {
            indicesStop.push(i);
        }
    });
    if (debug) IJ.log(indicesStop);
    if (indicesStop.length < 2) throw "Not enough stops";
    if (debug) IJ.log("Grouping all stops...");
    var stops = [{
        x: xArray[indicesStop[0] + 1],
        y: yArray[indicesStop[0] + 1]
    }];
    var count = 1;
    for (i = 1; i < indicesStop.length; i++) {
        if (indicesStop[i - 1] === indicesStop[i] - 1) {
            stops[stops.length - 1].x += xArray[indicesStop[i] + 1];
            stops[stops.length - 1].y += yArray[indicesStop[i] + 1];
            count++;
        } else {
            stops[stops.length - 1].x /= count;
            stops[stops.length - 1].y /= count;
            count = 1;
            stops.push({
                x: xArray[indicesStop[i] + 1],
                y: yArray[indicesStop[i] + 1]
            });
        }
    }
    stops[stops.length - 1].x /= count;
    stops[stops.length - 1].y /= count;
    
    if (stops.length < 2) throw "Not enough stops";
    if (debug) IJ.log("Calculating vectors...");
    var vectors = new Array(stops.length - 1);
    for (i = 0; i < vectors.length; i++) {
        var dx = stops[i + 1].x - stops[i].x;
        var dy = stops[i + 1].y - stops[i].y;
        vectors[i] = {
            length: Math.sqrt(
                Math.pow(dx, 2) +
                Math.pow(dy, 2)
            ),
            angle: Math.atan2(dy, dx) * 180 / Math.PI
        };
    }
    vectors.forEach(function(v) {
        IJ.log("angle: " + v.angle + " degrees, length: " + v.length + " pixels");
    });
    return {
        vectors: vectors
    };
};
