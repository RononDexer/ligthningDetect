//caractère ("A", "b", "1")
//vecteurs {angle, angleInst}
function Lettre(tabDirections,tabDirectionsOiseau,lettreStr,type) {
  for (var itab=0;itab<2;itab++){
    tabDir = (itab === 0) ? tabDirections : tabDirectionsOiseau;
    for(var i=0;i<tabDir.length;i++){
      tabD2=tabDirections[i];
      if(typeof type !== "undefined"){
        if(type==="clock"){
          for(var i=0;i<tabD2.length;i++){
              tabD2[i]=Math.abs(tabD2[i]-12);
              tabD2[i]=(tabD2[i]+3)/12;
          }
        } 
        else if(type==="angle"){
          for(var i=0;i<tabD2.length;i++){
              tabD2[i]/=360;
          }
        }
      }
    }
  }
  this.tabDirections=tabDirections;
  this.tabDirectionsOiseau=tabDirectionsOiseau;
  this.lettre=lettreStr;
  this.prob=0.5; 
};

Lettre.prototype.calcProb=function(modif){
  //modif compris entre -1 et 1
  if (modif<0) {
    this.prob-=Math.abs(modif*this.prob);
  }
  else {
    this.prob+=modif*(1-this.prob);
  }
}

Lettre.prototype.determineCharacter(lettreADeterminer){
  this.prob=0.5;
  
}

var A = new Lettre([[45+22.5,360-67.5]],[],"A","angle");
var B = new Lettre([[360-90,90,0,0][90,0,0]], [],"B","angle");
var C = new Lettre([[180]],[],"C","angle");


