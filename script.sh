#!/bin/bash

# à appeler "./script.sh CHEMIN_VERS_LE_FICHIER_TIF,NIVEAU_DE_VERBOSITÉ"

#java -jar ImageJ/ij.jar -batch  import.js $@
java -jar ImageJ/ij.jar -macro import.js $@
