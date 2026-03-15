
# A very simple Flask Hello World app for you to get started with...

from flask import Flask, render_template, session, request, redirect, url_for
import random
app = Flask(__name__, template_folder = './')
app.secret_key = "8964tam"

@app.route('/', methods=['GET','POST'])
def index():
    if request.method == 'GET':
        return render_template('index.html')
    elif request.method == 'POST':
        session['user_name'] = request.form.get('user_name')
        return redirect(url_for('number_game'))

@app.route('/number_game/', methods=['GET','POST'])
def number_game():
    try:
        user_name=session['user_name']
    except KeyError:
        return redirect(url_for('index'))

    if request.method == 'GET':
        session['answer'] = random.randint(1, 100)
        return render_template('number_game.html', user_name=user_name, msg='', win=False)
    elif request.method == 'POST':
        guess = int(request.form.get('guess'))
        answer = session['answer']
        if guess > answer:
            return render_template('number_game.html', user_name=user_name, msg='the answer is smaller than yours.', win=False)
        elif guess < answer:
            return render_template('number_game.html', user_name=user_name, msg='the answer is larger than yours.', win=False)
        else:
            return render_template('number_game.html', user_name=user_name, msg=f'You find it! The answer is {answer}.', win=True)


