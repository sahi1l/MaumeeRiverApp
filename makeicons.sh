#!/bin/zsh
if [[ $# -eq 1 ]] ; then
    square=icon.${1/#*./}
    ln -f $1 $square
else
    square=(icon*)
    if [[ ${#square} -gt 0 ]] ; then
        square=$square[1]
    else
        echo "Icon not found."
        exit
    fi
fi

folder="android/app/src/main/res"
for pfx res in m 48 h 72 xh 96 xxh 144 xxxh 192; do
    for src sfx in $square "_foreground"; do
        magick convert $src -resize ${res}x${res} $folder/mipmap-${pfx}dpi/ic_launcher$sfx.png
    done
done
