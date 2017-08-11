#!/bin/bash
set -e
CLOUD_CONFIG_FILE=pxe-cloud-config.yml

<% if( typeof progressMilestones !== 'undefined' && progressMilestones.installToDiskUri ) { %>
curl -X POST -H 'Content-Type:application/json' 'http://<%=server%>:<%=port%><%-progressMilestones.installToDiskUri%>' || true
<% } %>

curl -o $CLOUD_CONFIG_FILE http://<%=server%>:<%=port%>/api/current/templates/$CLOUD_CONFIG_FILE?nodeId=<%=nodeId%>

<% if (typeof ignitionScriptUri !== 'undefined') { %>
IGNITION_SCRIPT_FILE=ignition.json
  <% if (typeof vaultToken !== 'undefined') { %>
    curl -o ${IGNITION_SCRIPT_FILE}.tmp -X POST -d '' -H 'X-Vault-Token: <%=vaultToken%>' <%=ignitionScriptUri%>
    jq '.data' ${IGNITION_SCRIPT_FILE}.tmp > ${IGNITION_SCRIPT_FILE}
  <% } else { %>
    curl -o ${IGNITION_SCRIPT_FILE} <%=ignitionScriptUri%>
  <% } %>
    sudo coreos-install -d <%=installDisk%> -i ${IGNITION_SCRIPT_FILE} -b <%=repo%>
<% } else { %>
  sudo coreos-install -d <%=installDisk%> -c ${CLOUD_CONFIG_FILE} -b <%=repo%>
<% } %>

curl -X POST -H 'Content-Type:application/json' http://<%=server%>:<%=port%>/api/current/notification?nodeId=<%=nodeId%>
sudo reboot
