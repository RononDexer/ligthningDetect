"use strict";
var debug = Boolean(getArgument());
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
subSlices[subSlices.length - 1].end = subSlices[subSlices.length - 1].end || i;
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
