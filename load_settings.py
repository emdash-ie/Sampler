#!/usr/local/bin/python3

from cgitb import enable
enable()

from cgi import FieldStorage, escape
import pymysql as db



form_data = FieldStorage()


if len(form_data) != 0:
	print('Content-Type: text/plain')
	print()

	id = escape(form_data.getfirst('id', '').strip())
	display = escape(form_data.getfirst('display', '').strip())

	if id:
		try:
			connection = db.connect('cs1dev.ucc.ie', 'nfb2', '', '2019_nfb2')
			cursor = connection.cursor(db.cursors.DictCursor)
			cursor.execute('''SELECT * FROM presets WHERE id = %s''', (id))

			if cursor.rowcount == 0:
				print('Error: Preset does not exist')
			else:
				row = cursor.fetchone()
				count = 0
				for key in row:
					print('%s*%s' % (key, row[key]), end = '')
					count += 1
					if count != len(row):
						print('*', end = '')
		except db.Error:
			print('Error: Database error')

	elif display:
		try:
			connection = db.connect('cs1dev.ucc.ie', 'nfb2', '***REMOVED***', '2019_nfb2')
			cursor = connection.cursor(db.cursors.DictCursor)
			cursor.execute('''SELECT name, id FROM presets''')
			count = 0
			for row in cursor.fetchall():
				print(str(row['id']) + '_' + row['name'], end='')
				count += 1
				if count != cursor.rowcount:
					print('_', end = '')
		except db.Error:
			print('Error: Database error')
	else:
		print('Error: Wrong details provided')
else:
	print('Content-Type: text/html')
	print('Status: 303 See Other')
	print('Location: index.html')
	print()
