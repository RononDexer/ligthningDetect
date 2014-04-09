#!/bin/bash

# à appeler "./script.sh CHEMIN_VERS_LE_FICHIER_TIF,NIVEAU_DE_VERBOSITÉ"

#java -Xmx2048m -jar ImageJ/ij.jar -batch  import.js $@
java -Xmx4096m -jar ImageJ/ij.jar -macro import.js $@
