curl http://<%=server%>:<%=port%>/templates/unattend_server2012.xml -Outfile unattend_server2012.xml

$vlanEntries = Get-Content -Path C:\temp\unattend_server2012.xml  | Where-Object {$_ -like "*VLan*"}
$vlansArray = New-Object System.Collections.ArrayList

#Removing the 'VLAN::ID" tag from the unattend_server2012.xml file
foreach ($vlanEntry in $vlanEntries)
	{
		$line= $vlanEntry | out-String
		$cleanedline= $line.split("::")
		$vlanItem= $cleanedline[2]
		$vlansArray.add($vlanItem)
		$vlansArray

	}
$ethPort
$tempArray

foreach ($entry in $vlansArray)
	{

		$tempArray= $entry.split(",")#The first element of the tempArray is the name of the Ethernet port, the second element is the value of the VLAND ID to be assigned to the Ethernet port
		$ethPort = $tempArray[0]
		Get-NetAdapterAdvancedProperty $ethPort -RegistryKeyword "VlanID"
		If($? -eq "0") #Make sure that VLAN is supported  on a the specified Ethernet port

			{
				Write-Host "Vlan is supported on" $ethPort "Ethernet port"
				[string]$vlanValue = $tempArray[1]
				$vlanValue =$vlanValue -replace "`t|`n|`r","" #remove the carriage returns
				IF($vlanValue -le 4096)
					{
						Set-NetAdapterAdvancedProperty $ethPort -RegistryKeyword "VlanID" -DisplayValue $vlanValue
					}
				Else
					{
						Write-Host "Vlan value should with the 0-4096 range"
					}
			}
		Else
			{
				Write-Host "Vlan is NOT supported on" $ethPort "Ethernet port"
			}

	}


#crul the renasar-ansible.pub to indicate that windows install workflow has completed
curl http://<%=server%>:<%=port%>/api/2.0/templates/renasar-ansible.pub -Outfile renasar-ansible.pub
