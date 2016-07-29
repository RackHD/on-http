<% if ( typeof networkDevices !== 'undefined' ) { %>
            <% networkDevices.forEach(function(n) { %>
                  <% if(   typeof n.ipv4.vlanIds !== 'undefined') { %>
                        Get-NetAdapterAdvancedProperty <%= n.device%> -RegistryKeyword "VlanID"
                        If($? -eq "0") #Make sure that VLAN is supported  on a the specified Ethernet port

                            {
                                Write-Host "Vlan is supported on <%= n.device%> Ethernet port"
                                IF(<%=n.ipv4.vlanIds[0]%> -ge 0 -Or <%=n.ipv4.vlanIds[0]%> -le 4095)
                                    {
                                        Set-NetAdapterAdvancedProperty <%= n.device%> -RegistryKeyword "VlanID" -DisplayValue <%=n.ipv4.vlanIds[0]%>
                                    }
                                Else
                                    {
                                        Write-Host "Vlan value should with the 0-4095 range"
                                    }
                            }
                        Else
                            {
                                Write-Host "Vlan is NOT supported on <%= n.device%> Ethernet port"
                            }

                   <% }%>

           <%});%>
<% } %>


#curl the renasar-ansible.pub to indicate that windows install workflow has completed
curl http://<%=server%>:<%=port%>/api/2.0/templates/renasar-ansible.pub -Outfile renasar-ansible.pub
