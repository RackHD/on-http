#!/usr/bin/python

# Copyright 2016, EMC, Inc.

"""
Download and execute python scripts from the RackHD tasks api in a loop
"""

import requests
import json
import sys
from time import sleep


TASK_REQUEST_PERIOD = 5
TASKS_URI = 'http://<%=server%>:<%=port%>/api/current/tasks/<%=identifier%>'

json_content_type = {"Content-Type": "application/json"}

def download_task_data():
    """
    Download a python script from the tasks API
    """
    print("Download Task", TASKS_URI)
    session = requests.Session()
    response = session.get(TASKS_URI, auth=("", ""))
    _task_data = response.text
    session.close()
    return json.loads(_task_data)


def download_script(downloadUrl):
    """
    Download a python script from the tasks API
    """
    session = requests.Session()
    url = 'http://<%=server%>:<%=port%>' + downloadUrl
    print("Downloading script at {}".format(url))
    script = session.get(url, auth=("", ""))
    session.close()
    with open('script.py', 'w') as rackhd_script:
        rackhd_script.write(script.text)

while True:
    try:
        print("task")
        task_data = download_task_data()
    except Exception as e:
        print("Failed to download task data, sleeping for {} seconds".format(TASK_REQUEST_PERIOD))
        sleep(TASK_REQUEST_PERIOD)
        continue

    for task in task_data['tasks']:
        try:
            download_script(task['downloadUrl'])
            script_locals = {}

            exec(open("./script.py").read(), script_locals)
            script_main = script_locals['main']

            # TODO: support task_data['result'] on the server-side since this isn't
            #       really stdout...
            result = script_main()
            # Yes, this gets json dumped again, but the server will treat it as
            # stringified JSON so make it easy for the server
            task['stdout'] = json.dumps(result)
        except Exception as error:
            print("Failure running task {}".format(error))
            task['error'] = str(error)
            break

    try:
        if "exit" in task_data.keys():
            print("Task execution complete")
            sys.exit(int(task_data["exit"]))
        task_data = json.dumps(task_data)
        session = requests.Session()
        req = session.post(TASKS_URI, data=task_data, auth=("", ""), headers=json_content_type)
        session.close()
    except Exception as error:
        task_data = [{'error': str(error)}]
        task_data = json.dumps(task_data)
        session = requests.Session()
        req = session.post(TASKS_URI, data=task_data, auth=("", ""), headers=json_content_type)
        session.close()

    for _ in range(3):
        try:
            print("Posting task data\n {}".format(task_data))
            session = requests.Session()
            response = session.get(req)
            session.close()
        except:
            sleep(TASK_REQUEST_PERIOD)
            continue
        break

    sleep(TASK_REQUEST_PERIOD)
