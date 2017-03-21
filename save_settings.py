#!/usr/local/bin/python3

from cgitb import enable
enable()

from cgi import FieldStorage, escape
import pymysql as db

pgains = []
filenames = []
dsends = []

form_data = FieldStorage()

if len(form_data) != 0:
        print('Content-Type: text/plain')
        print()
        
        for n in range(1, 10):
        	filenames += [escape(form_data.getfirst('filename' + str(n), '').strip())]
        
        for n in range(1, 10):
        	pgains += [escape(form_data.getfirst('pgain' + str(n), '').strip())]
        	
        for n in range(1, 10):
        	dsends += [escape(form_data.getfirst('dsend' + str(n), '').strip())]
        	
        dlevel = escape(form_data.getfirst('dlevel', '').strip())
        
        dfeedback = escape(form_data.getfirst('dfeedback', '').strip())
        	
        cthresh = escape(form_data.getfirst('cthresh', '').strip())
        
        cratio = escape(form_data.getfirst('cratio', '').strip())
        
        cgain = escape(form_data.getfirst('cgain', '').strip())
        
        distgain = escape(form_data.getfirst('distgain', '').strip())
        
        distcurve = escape(form_data.getfirst('distcurve', '').strip())
        
        mgain = escape(form_data.getfirst('mgain', '').strip())
        
        name = escape(form_data.getfirst('name', '').strip())
        
        newname = ''
        
        for char in name:
        	if char == '*':
        		newname += ' '
        	else:
        		newname += char
        
        statement = 'INSERT INTO presets ('
        
        for n in range(1, 10):
        	statement += 'filename' + str(n) + ', '
        	statement += 'pgain' + str(n) + ', '
        	statement += 'dsend' + str(n) + ', '
        
        statement += 'dlevel, dfeedback, '
        statement += 'cthresh, cratio, cgain, '
        statement += 'distgain, distcurve, '
        statement += 'mgain, name)'
        
        statement += ' VALUES ('
        statement += '%s, ' * 35
        statement += '%s);'
        
        insertables = ()
        
        for n in range(9):
        	insertables += (filenames[n],)
        	insertables += (pgains[n],)
        	insertables += (dsends[n],)
        
        insertables += (dlevel,)
        insertables += (dfeedback,)
        insertables += (cthresh,)
        insertables += (cratio,)
        insertables += (cgain,)
        insertables += (distgain,)
        insertables += (distcurve,)
        insertables += (mgain,)
        insertables += (newname,)
        
        try:
                connection = db.connect('cs1dev.ucc.ie', 'nfb2', '***REMOVED***', '2019_nfb2')
                cursor = connection.cursor(db.cursors.DictCursor)
                cursor.execute(statement, insertables)
                connection.commit()
                cursor.close()
                connection.close()
                print('Preset saved')
        except db.Error:
                print('Database error')
        
else:
        print('Content-Type: text/html')
        print('Status: 303 See Other')
        print('Location: index.html')
        print()
