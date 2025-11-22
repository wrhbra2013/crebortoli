# /home/wander/Público/crebortoli/paginas/forms.py

from flask_wtf import FlaskForm
from wtforms import StringField, DateField, TimeField, SelectField, SubmitField
from wtforms.validators import DataRequired, Email, Length

class AgendaForm(FlaskForm):
    """Formulário de agendamento."""
    nome = StringField('Nome Completo', validators=[DataRequired(), Length(min=3, max=100)])
    email = StringField('Email', validators=[DataRequired(), Email()])
    telefone = StringField('Telefone', validators=[DataRequired(), Length(min=10, max=15)])
    data = DateField('Data do Agendamento', format='%Y-%m-%d', validators=[DataRequired()])
    hora = TimeField('Hora do Agendamento', format='%H:%M', validators=[DataRequired()])
    servico = SelectField('Serviço Desejado', choices=[
        ('limpeza_pele', 'Limpeza de Pele'),
        ('depilacao', 'Depilação'),
        ('massagem', 'Massagem Relaxante'),
        # Adicione outras opções de serviço conforme necessário
    ], validators=[DataRequired()])
    submit = SubmitField('Solicitar Agendamento')
