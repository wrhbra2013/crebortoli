from crebortoli import app 
import webbrowser

application = app
if __name__ =='_main_':
    webbrowser.open_new(app.run(app.run(debug=True, host='0.0.0.0', port=5000)))