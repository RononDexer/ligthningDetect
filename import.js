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

//Détermination du temps minimal des lettres et entre les lettres
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
                    st.y - letter.dots[stopIndices[i - 1] + 3].y,
                    st.x - letter.dots[stopIndices[i - 1] + 3].x
                );
            } catch (err) {
                instAngle = 0;
            }
            IJ.log(instAngle);
            letter.vectors.push({instAngle: instAngle});
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

//Juste pour rappel, pour afficher comment est stockée dans un object JS une lettre détectée
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

//Définition d'un modèle
var LetterTemplate = function(parameters) {
    this.char = parameters.char;
    this.vectors = parameters.vectors;//.length === stops.length - 1
};
//Définition de la méthode de calcul de score
LetterTemplate.prototype.score = function(letter) {
    var value = 0.5;
    var difNbStops = Math.abs(letter.stops.length - 1 - this.vectors.length);
    if (difNbStops > 1) {//trop de différence dans le nombre de point d'arrêt
        return 0;
    } else if (difNbStops === 1) {//Il y a plus ou moins un point d'arrêt, peut-être une erreur dans l'analyse
        return 0.2;
    } // même nombre de points d'arrêt, donc comparaison des vecteurs.
    this.vectors.forEach(function(vecteur) {

    });
    return value;
};

//Création des modèles de lettre
var templates = [
    new LetterTemplate({char: "A", vectors: [
        {instAngle: Math.atan2(3, 1), speed: 1, angle: Math.atan2(3, 1)},
        {instAngle: Math.atan2(-3, 1), speed: 1, angle: Math.atan2(-3, 1)}
    ]}),
    new LetterTemplate({char: "A", vectors: [
        {instAngle: Math.atan2(3, 1), speed: 1, angle: Math.atan2(3, 1)},
        {instAngle: Math.atan2(-3, 1), speed: 1, angle: Math.atan2(-3, 1)},
        {instAngle: Math.atan2(3, -1), speed: 0.5, angle: Math.atan2(1.5, -0.8)}
    ]}),
    new LetterTemplate({char: "B", vectors: [
        {instAngle: Math.atan2(-3, 0), speed: 1, angle: Math.atan2(-3, 0)},
        {instAngle: Math.atan2(0, 1), speed: 0.5, angle: Math.atan2(1.5, 0)},
        {instAngle: Math.atan2(0, 1), speed: 0.5, angle: Math.atan2(1.5, 0)}
    ]}),
    new LetterTemplate({char: "L", vectors: [
        {instAngle: Math.atan2(-3, 0), speed: 1, angle: Math.atan2(-3, 0)},
        {instAngle: Math.atan2(0, 1), speed: 0.33, angle: Math.atan2(0, 1)}
    ]}),
    new LetterTemplate({char: "S", vectors: [
        {instAngle: Math.atan2(-3, -1), speed: 1, angle: Math.atan2(0, -1)},
    ]}),
    new LetterTemplate({char: "T", vectors: [
        {instAngle: Math.atan2(0, 1), speed: 1, angle: Math.atan2(0, 1)},
        {instAngle: Math.atan2(-3, 0), speed: 3, angle: Math.atan2(-3, 0)}
    ]}),
    new LetterTemplate({char: "T", vectors: [
        {instAngle: Math.atan2(0, 1), speed: 1, angle: Math.atan2(0, 1)},
        {instAngle: Math.atan2(0, -1), speed: 0.5, angle: Math.atan2(0, -1)},
        {instAngle: Math.atan2(-3, 0), speed: 3, angle: Math.atan2(-3, 0)}
    ]}),
    new LetterTemplate({char: "U", vectors: [
        {instAngle: Math.atan2(-1, 0), speed: 1, angle: Math.atan2(0, 1)}
    ]})
];

//Comparaison lettre à lettre avec les modèles et affiche du score
letters.forEach(function(letter) {
    IJ.log(templates.map(function(template) {
        return template.score(letter);
    }));
});
