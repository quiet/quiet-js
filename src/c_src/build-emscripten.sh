#!/usr/bin/env bash
set -e

SCRIPTNAME=`basename $0`

PATHPREFIX=`dirname $0`
ABSPATH=`cd "$PATHPREFIX"; pwd`
SRCPATH=$ABSPATH
DOWNLOADSPATH="$ABSPATH/emscripten/downloads"
SYSROOTPATH="$ABSPATH/emscripten/sysroot"
BUILDPATH="$ABSPATH/emscripten/build"
JSPATH="$ABSPATH/js"
LICENSEPATH="$ABSPATH/licenses"

# if [ ! -d "$SRCPATH/emscripten" ]; then
#     echo
#     echo "$SCRIPTNAME uses emscripten to cross-compile for Javascript."
#     echo "If you already have emscripten installed it can"
#     echo "be helpful to let $SCRIPTNAME use it so that other projects you build"
#     echo "with the NDK can include headers and link to the dependencies built here"
#     echo
#     echo "Enter the path to emscripten or leave blank to have $SCRIPTNAME download it"
#     echo
#     echo -n "emscripten: "
#     read -e EMSCRIPTENPATH
#     if [ -z "$EMSCRIPTENPATH" ]; then
#         mkdir -p "$DOWNLOADSPATH"
#         LLVMURL="https://github.com/kripken/emscripten-fastcomp/archive/1.36.10.zip"
#         echo "Downloading $LLVMURL"
#         curl -L --progress-bar -o "$DOWNLOADSPATH/emscripten-fastcomp.zip" "$LLVMURL"
#         echo "Unzipping"
#         unzip "$DOWNLOADSPATH/emscripten-fastcomp.zip" -d "$DOWNLOADSPATH" >/dev/null
#         mv "$DOWNLOADSPATH/emscripten-fastcomp-1.36.10" "$SRCPATH/emscripten-fastcomp"
#         CLANGURL="https://github.com/kripken/emscripten-fastcomp-clang/archive/1.36.10.zip"
#         echo "Downloading $CLANGURL"
#         curl -L --progress-bar -o "$DOWNLOADSPATH/emscripten-fastcomp-clang.zip" "$CLANGURL"
#         echo "Unzipping"
#         unzip "$DOWNLOADSPATH/emscripten-fastcomp-clang.zip" -d "$DOWNLOADSPATH" >/dev/null
#         mv "$DOWNLOADSPATH/emscripten-fastcomp-clang-1.36.10" "$SRCPATH/emscripten-fastcomp/tools/clang"
#         echo "Building"
#         cd "$SRCPATH/emscripten-fastcomp"
#         mkdir build
#         cd build
#         cmake ..
#         make clang
#         EMSCRIPTENURL="https://github.com/kripken/emscripten/archive/1.36.10.zip"
#         echo "Downloading $EMSCRIPTENURL"
#         curl -L --progress-bar -o "$DOWNLOADSPATH/emscripten.zip" "$EMSCRIPTENURL"
#         echo "Unzipping"
#         unzip "$DOWNLOADSPATH/emscripten.zip" -d "$DOWNLOADSPATH" >/dev/null
#         mv "$DOWNLOADSPATH/emscripten-1.36.10" "$SRCPATH/emscripten"
#     else
#         ABSEMSCRIPTENPATH=`cd "$EMSCRIPTENPATH"; pwd`
#         ln -s "$ABSEMSCRIPTENPATH" "$SRCPATH/emscripten"
#     fi
# fi

if [ ! -d "$SYSROOTPATH/usr" ]; then
    mkdir -p "$SYSROOTPATH/usr"
fi

export SYSROOT="$SYSROOTPATH"
export PATH="$EMSCRIPTEN:$CLANGPATH:$PATH"
mkdir -p "$BUILDPATH"
export EMSCRIPTEN=`python -c "import imp; em = imp.load_source('emscripten', '$HOME/.emscripten'); print(em.EMSCRIPTEN_ROOT)"`

mkdir -p "$BUILDPATH/libcorrect"
cd "$BUILDPATH/libcorrect"
cp "$SRCPATH/Emscripten.cmake" .
cmake -DCMAKE_TOOLCHAIN_FILE="./Emscripten.cmake" -DCMAKE_BUILD_TYPE=Release "$SRCPATH/libcorrect" -DCMAKE_PREFIX_PATH="$SYSROOT" -DCMAKE_INSTALL_PREFIX="$SYSROOT/usr" -DCMAKE_LINK_LIBRARY_SUFFIX=".bc" -DEMSCRIPTEN_GENERATE_BITCODE_STATIC_LIBRARIES="on" && make && make shim && make install

mkdir -p "$BUILDPATH/liquid-dsp"
cd "$BUILDPATH/liquid-dsp"
cp "$SRCPATH/Emscripten.cmake" .
cmake -DCMAKE_TOOLCHAIN_FILE="./Emscripten.cmake" -DCMAKE_BUILD_TYPE=Release "$SRCPATH/liquid-dsp" -DCMAKE_SYSROOT="$SYSROOT" -DCMAKE_PREFIX_PATH="$SYSROOT/usr" -DCMAKE_INSTALL_PREFIX="$SYSROOT/usr" -DCMAKE_LINK_LIBRARY_SUFFIX=".bc" -DEMSCRIPTEN_GENERATE_BITCODE_STATIC_LIBRARIES="on" -DLIQUID_BUILD_EXAMPLES="off" -DLIQUID_BUILD_SANDBOX="off" && make liquid-static liquid-shared && make install

mkdir -p "$BUILDPATH/jansson"
cd "$BUILDPATH/jansson"
cp "$SRCPATH/Emscripten.cmake" .
cmake -DCMAKE_TOOLCHAIN_FILE="./Emscripten.cmake" -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX="$SYSROOT/usr" -DJANSSON_BUILD_SHARED_LIBS=off -DJANSSON_WITHOUT_TESTS=on -DJANSSON_EXAMPLES=off -DJANSSON_BUILD_DOCS=off "$SRCPATH/jansson" && make && make install

mkdir -p "$BUILDPATH/quiet"
cd "$BUILDPATH/quiet"
cp "$SRCPATH/Emscripten.cmake" .
cmake -DCMAKE_TOOLCHAIN_FILE="./Emscripten.cmake" -DCMAKE_BUILD_TYPE=Release -DCMAKE_PREFIX_PATH="$SYSROOT/usr" -DCMAKE_SYSROOT="$SYSROOT" -DCMAKE_C_FLAGS="-I$SYSROOT/usr/include -lfec" -DCMAKE_EXE_LINKER_FLAGS="-L$SYSROOT/usr/lib" -DCMAKE_INSTALL_PREFIX="$SYSROOT/usr" "$SRCPATH/quiet" -DEMSCRIPTEN_GENERATE_BITCODE_STATIC_LIBRARIES="on" && make && make install

emcc -v -Oz $BUILDPATH/quiet/lib/libquiet.bc -L$SYSROOT/usr/lib -o quiet-emscripten.js -s ASSERTIONS=1 -s MODULARIZE=1 -s EXPORT_NAME="'quiet_emscripten'" -s EXPORTED_FUNCTIONS="['_quiet_decoder_consume', '_quiet_decoder_create', '_quiet_decoder_flush', '_quiet_decoder_recv', '_quiet_decoder_destroy', '_quiet_encoder_emit', '_quiet_encoder_create', '_quiet_encoder_destroy', '_quiet_encoder_send', '_quiet_encoder_get_frame_len', '_quiet_encoder_profile_str', '_quiet_decoder_profile_str', '_quiet_encoder_clamp_frame_len', '_quiet_decoder_checksum_fails', '_quiet_decoder_enable_stats', '_quiet_decoder_disable_stats', '_quiet_decoder_consume_stats']" -lliquid -ljansson -lfec
mv quiet-emscripten.js quiet-emscripten-var.js
cat "$SRCPATH/emscripten-pre.js" > quiet-emscripten.js
cat quiet-emscripten-var.js >> quiet-emscripten.js
cat "$SRCPATH/emscripten-post.js" >> quiet-emscripten.js

mkdir -p "$JSPATH"
cp "$BUILDPATH/quiet/quiet-emscripten.js" $JSPATH
cp "$BUILDPATH/quiet/quiet-emscripten.js.mem" $JSPATH
cp "$BUILDPATH/quiet/share/quiet-profiles.json" $JSPATH

mkdir -p "$LICENSEPATH"
cp "$SRCPATH/libcorrect/LICENSE" "$LICENSEPATH/libcorrect"
cp "$SRCPATH/liquid-dsp/LICENSE" "$LICENSEPATH/liquid-dsp"
cp "$SRCPATH/jansson/LICENSE" "$LICENSEPATH/jansson"
cp "$SRCPATH/quiet/LICENSE" "$LICENSEPATH/quiet"

echo
echo "Build complete. Built js is in $JSPATH."
echo "Third-party licenses are in $LICENSEPATH."
