"use strict";

//Ajout d'une fonction average au prototype Array
Array.prototype.average = function() {
    return (this.length) ? this.reduce(function(a, b) {
        return a + b;
    }) / this.length : 0;
};

//Récupère les différents arguments
var args = getArgument().split(/,/);
var debug = parseInt(args[1]);

//Ouverture de l'image
var imp = IJ.openImage(args[0]);
if (debug) {imp.show();}
//Traitements
IJ.setMinAndMax(imp, 126, 128);
IJ.run(imp, "Apply LUT", "stack");
IJ.run(imp, "8-bit", "");
IJ.run(imp, "Make Binary", "method=Otsu background=Dark calculate");
IJ.run(imp, "Flip Horizontally", "stack");

if (debug) {
    IJ.run(imp, "Z Project...", "projection=[Standard Deviation]");
    var project = IJ.getImage();
    IJ.run(project, "RGB Color", "");
}

//Mesures, isolation des artéfacts,
IJ.run("Set Measurements...", "area center stack redirect=None decimal=3");
var mean    = 0,
    SD      = 1;
while(SD > mean / 4) {
    IJ.run(imp, "Analyze Particles...", "size=" + parseInt(mean/2) + "-Infinity clear stack");
    IJ.run("Summarize", "");
    var table = ResultsTable.getResultsTable();
    var areas = table.getColumn(table.getColumnIndex("Area"));
    mean  = areas[areas.length-4];
    SD = areas[areas.length-3];
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
        IJ.log("Lettre " + (i + 1) + " de slice " + slices[sub.start] + " a " + slices[sub.end]);
    });
}

var xArrayAll = table.getColumn(table.getColumnIndex("XM"));
var yArrayAll = table.getColumn(table.getColumnIndex("YM"));

var letters = subSlices.map(function(sub, i) {
    var letter = {
        r: (i % 3 === 0) ? (Math.random() + 1) / 2 : 0,
        g: (i % 3 === 1) ? (Math.random() + 1) / 2 : 0,
        b: (i % 3 === 2) ? (Math.random() + 1) / 2 : 0,
        dots: []
    };
    for (var i = sub.start; i <= sub.end; i++) {
        letter.dots.push({
            x: xArrayAll[i],
            y: yArrayAll[i]
        });
    }
    return letter;
});

if (debug) {
    var ip = project.getProcessor();
    letters.forEach(function(letter) {
        ip.setColor(new java.awt.Color(letter.r, letter.g, letter.b));
        letter.dots.forEach(function(dot) {
            ip.fillOval(dot.x - 1, dot.y - 1, 2, 2);
        });
    });
    project.setProcessor(ip);
    project.show();
}

letters.forEach(function(letter, i) {
    letter.instVectors = letter.dots.map(function(dot, i, dots) {
        try {
            var dx = dots[i - 1].x - dots[i + 1].x,
                dy = dots[i - 1].y - dots[i + 1].y;
            var angle = Math.atan2(dy, dx);// * 180 / Math.PI;
            return {
                speed: Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2)),
                //angle: (angle >= 0) ? angle : 360 + angle
                angle: angle
            };
        } catch (err) {
            return {speed: 0, angle: 0};
        }
    });
    var sortedSpeeds = letter.instVectors.map(function(e) {return e.speed;}).sort(function(a, b) {return a - b;});
    letter.minSpeed = sortedSpeeds.slice(parseInt(sortedSpeeds.length / 2), sortedSpeeds.length).average() / 2;
    letter.minSpeed = sortedSpeeds.average() / 2;
    //letter.minSpeed = sortedSpeeds[parseInt(sortedSpeeds.length / 4)];
    if (debug > 2) {
        var x = new java.lang.reflect.Array.newInstance(java.lang.Double.TYPE, letter.instVectors.length);
        var sp = new java.lang.reflect.Array.newInstance(java.lang.Double.TYPE, letter.instVectors.length);
        var an = new java.lang.reflect.Array.newInstance(java.lang.Double.TYPE, letter.instVectors.length);
        var ssp = new java.lang.reflect.Array.newInstance(java.lang.Double.TYPE, letter.instVectors.length);
        letter.instVectors.forEach(function(e, i) {
            x[i] = i;
            sp[i] = e.speed;
            an[i] = e.angle;
            ssp[i] = sortedSpeeds[i];
        });
        var plot1 = new Plot("Speeds of letter " + (i + 1), "Dot", "Speed", x, sp);
        plot1.show();
        var plot2 = new Plot("Angle of letter " + (i + 1), "Dot", "Angle", x, an);
        plot2.show();
        var plot3 = new Plot("Sorted speeds of letter " + (i + 1), "Dot", "Speed", x, ssp);
        plot3.show();
    }
    var stopIndices = [];
    letter.instVectors.forEach(function(e, i) {
        if (e.speed < letter.minSpeed) {
            stopIndices.push(i);
        }
    });
    letter.stops = [{
        x: letter.dots[stopIndices[0]].x,
        y: letter.dots[stopIndices[0]].y
    }];
    letter.vectors = [];
    for (var i = 1, count = 1; i < stopIndices.length; i++, count++) {
        var st = letter.stops[letter.stops.length - 1],
            index = stopIndices[i];
        if (index - 1 === stopIndices[i - 1]) {//même stop
            st.x += letter.dots[index].x;
            st.y += letter.dots[index].y;
        } else {//nouveau stop
            st.x /= count;
            st.y /= count;
            var instAngle;
            try {
                instAngle = Math.atan2(
                    letter.dots[index - 3].y - letter.dots[index + 1].y,
                    letter.dots[index - 3].x - letter.dots[index + 1].x
                );
            } catch (err) {
                instAngle = 0;
            }
            IJ.log(instAngle);
            letter.vectors.push({instAngle: instAngle});//FIXME certaines valeurs sont bizarres
            count = 0;
            letter.stops.push({
                x: letter.dots[index].x,
                y: letter.dots[index].y
            });
        }
    }
    letter.stops[letter.stops.length - 1].x /= count;
    letter.stops[letter.stops.length - 1].y /= count;
    letter.vectors.push({instAngle: letter.instVectors[stopIndices[i - 1]].angle});

    letter.vectors.forEach(function(vector, i) {
        var dx = 0,
            dy = 0;
        try {
            dx = letter.stops[i].x - letter.stops[i + 1].x;
            dy = letter.stops[i].y - letter.stops[i + 1].y;
        } catch (err) {}
        vector.speed = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
        vector.angle = Math.atan2(dy, dx);
    });
});

if (debug) {
    var ip = project.getProcessor();
    letters.forEach(function(letter) {
        if (debug > 1) {
            ip.setColor(new java.awt.Color(letter.r / 2, letter.g / 2, letter.b / 2));
            letter.dots.forEach(function(dot, i) {
                if (i % 4 === 0) {
                    var iVec = letter.instVectors[i];
                    var dx = iVec.speed * Math.cos(iVec.angle),
                        dy = iVec.speed * Math.sin(iVec.angle);
                    ip.drawLine(dot.x - dx, dot.y - dy, dot.x + dx, dot.y + dy);
                }
            });
        }
        ip.setColor(new java.awt.Color(letter.r ? letter.r : 0.3, letter.g ? letter.g : 0.3, letter.b ? letter.b : 0.3));
        letter.stops.forEach(function(st) {
            ip.fillOval(st.x - 4, st.y - 4, 8, 8);
        });
        ip.setColor(new java.awt.Color(letter.r ? letter.r : 0.45, letter.g ? letter.g : 0.45, letter.b ? letter.b : 0.45));
        letter.vectors.forEach(function(vector, i) {
            var st = letter.stops[i];
            var dx = vector.speed * Math.cos(vector.angle),
                dy = vector.speed * Math.sin(vector.angle);
            ip.drawLine(st.x, st.y, st.x - dx, st.y - dy);
            dx = vector.speed / 3 * Math.cos(vector.instAngle);
            dy = vector.speed / 3 * Math.sin(vector.instAngle);
            ip.drawLine(st.x, st.y, st.x - dx, st.y - dy);
        });
    });
    project.setProcessor(ip);
    project.show();
}

if (debug > 2) {
    IJ.log("Structure d'une lettre :");
    for (var key in letters[0]) {
        if (typeof letters[0][key][0] === "object") {
            IJ.log(" " + key + " : array of objects");
            for (var key2 in letters[0][key][0]) {
                IJ.log("     " + key2 + " : " + typeof letters[0][key][0][key2]);
            }
        } else {
            IJ.log(" " + key + " : " + typeof letters[0][key]);
        }
    }
}

//fonction calculant les angles et prenant en compte les décélérations
var processCoords = function(aSubSlice) {
    var xArray=xArrayAll.slice(aSubSlice.start,aSubSlice.end+1);
    var yArray=yArrayAll.slice(aSubSlice.start,aSubSlice.end+1);
    if (debug) {
        IJ.log("Process coordinates from letter beginning at slice : " + aSubSlice.start);
        IJ.log("Calculating speeds...");
    }
    var speeds = new Array(xArray.length - 2);
    for (var i = 0; i < speeds.length; i++) {
        speeds[i] = Math.sqrt(
            Math.pow(xArray[i + 2] - xArray[i], 2) +
            Math.pow(yArray[i + 2] - yArray[i], 2)
        );
    }
    if (debug) {
        IJ.log(speeds);
        IJ.log("Finding all stops...");
    }
    //calcul de MIN_SPEED
    var MIN_SPEED=speeds.average()/2;
    if (debug) {IJ.log("Considerate stop if speed <"+MIN_SPEED);}
    var indicesStop = [];
    speeds.forEach(function(e, i) {
        if (e < MIN_SPEED) {
            indicesStop.push(i);
        }
    });
    if (debug) {IJ.log(indicesStop);}
    if (indicesStop.length < 2) {
        throw "Not enough stops";
    }
    if (debug) {IJ.log("Grouping all stops...");}
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
    
    if (stops.length < 2) {
        throw "Not enough stops";
    }
    if (debug) {IJ.log("Calculating vectors...");}
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
