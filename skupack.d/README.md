# SKU Pack Configuration

The SKU Pack Configuration directory consists of a set of configuration files and the directories
which host the content referenced by the files.  The content of the directories is used by on-http
to potentially override the files and templates that are served for nodes with SKUs.

## Typical Directory Layout

    .
    |-- 5661e0b5f0e1a18e6f18b98d
    |  |-- static
    |  |   \-- common
    |  |       \-- discovery.overlay.cpio.gz
    |  \-- templates
    |      |-- esx-ks
    |      \-- renasar-ansible.pub
    \-- 5661e0b5f0e1a18e6f18b98d.js

## :skuid.js Contents

The ":skuid.js" file specifies the location of the static root and template root for the SKU.  The 
directory locations specified in the filewill use the skupack.d/:skuid directory as the root reference 
for the directory names.

    {
        "httpStaticRoot": "static",
        "httpTemplateRoot": "templates"
    }

