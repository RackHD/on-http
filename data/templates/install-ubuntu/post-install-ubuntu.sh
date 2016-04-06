#!/bin/bash

<% if (undefined !== rootSshKey) { -%>
mkdir /root/.ssh
echo <%=rootSshKey%> > /root/.ssh/authorized_keys
chown -R root:root /root/.ssh
<% } -%>

<% users.forEach(function(user) { -%>
useradd -u <%=user.uid%> -m -p <%=user.encryptedPassword%> <%=user.name%>
    <%_ if (undefined !== user.sshKey) { _%>
mkdir /home/<%=user.name%>/.ssh
echo <%=user.sshKey%> > /home/<%=user.name%>/.ssh/authorized_keys
chown -R <%=user.name%>:<%=user.name%> /home/<%=user.name%>/.ssh
    <%_ } _%>
<% }); -%>

<% if (undefined !== networkDevices) { -%>
echo "
    <%_ networkDevices.forEach(function(n) { _%>
        <%_ for (p in n) { _%>
            <%_ ip = n[p]; _%>
            <%_ if (['ipv4', 'ipv6'].indexOf(p) === -1 || undefined == ip) continue; _%>
            <%_ if (undefined !== ip.vlanId) { _%>
                <%_ ip.vlanId.forEach(function(vid) { _%>
auto <%=n.device%>.<%=vid%>
iface <%=n.device%>.<%=vid%> inet static
address <%=ip.ipAddr%>
netmask <%=ip.netmask%>
gateway <%=ip.gateway%>

                <%_ }); _%>
            <%_ } else { _%>
auto <%=n.device%>
iface <%=n.device%> inet static
address <%=ip.ipAddr%>
netmask <%=ip.netmask%>
gateway <%=ip.gateway%>

            <%_ } _%>
        <%_ } _%>
    <%_ }); _%>
" > /etc/network/interfaces
<% } -%>

<% if (undefined !== dnsServers) { -%>
echo "search <%=domain%>" > /etc/resolv.conf
    <%_ dnsServers.forEach(function(dns) { _%>
echo "nameserver <%=dns%>" >> /etc/resolv.conf
    <%_ }); _%>
chattr +i /etc/resolv.conf
<% } -%>
