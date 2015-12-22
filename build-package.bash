#!/bin/bash
DEBDIR="./debianstatic/${1}"
BRANCH=${2}

if [ ! -d "${DEBDIR}" ]; then 
    echo "no such debian directory ${DEBDIR}"
    exit 1 
fi

rm -rf ${1}_*
rm -rf packagebuild 
mkdir -p packagebuild/debian 

git log -n 1 --pretty=format:%h.%ai.%s > commitstring.txt
export DEBFULLNAME=`git log -n 1 --pretty=format:%an`
export DEBEMAIL=`git log -n 1 --pretty=format:%ae`
export DEBBRANCH=`echo "${BRANCH}" | sed 's/[\/\_]/-/g'`  
export DEBPKGVER=`git log -n 1 --pretty=oneline --abbrev-commit`

rsync -ar --exclude=packagebuild \
          --exclude=debianstatic . packagebuild
pushd packagebuild
rsync -ar ../${DEBDIR}/ debian/
dch -l "${DEBBRANCH}" -u low "${DEBPKGVER}"
debuild --no-lintian --no-tgz-check -us -uc
popd
