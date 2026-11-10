extends Node2D
## Troca entre a vila e a masmorra.

const Vila = preload("res://scripts/vila.gd")
const Masmorra = preload("res://scripts/masmorra.gd")

var _atual: Node = null


func _ready() -> void:
	Jogo.pedir_cena.connect(_trocar, CONNECT_DEFERRED)
	_trocar("vila")
	if Jogo.primeira_vez:
		Narrador.falar("O Mestre ajeita os óculos e rola os dados atrás do escudo...")
		Narrador.falar("'Você herdou uma fazenda caindo aos pedaços. E uma masmorra no quintal. Parabéns.'")
		Narrador.falar("'Plante, regue, durma. E desça a masmorra para pagar as sementes. Simples.'")
		Jogo.primeira_vez = false
		Jogo.salvar()
	else:
		Narrador.falar("O Mestre abre o livro de novo: 'Onde paramos? Ah, dia %d.'" % Jogo.dia)


func _trocar(nome: String) -> void:
	if _atual != null:
		_atual.queue_free()
	if nome == "masmorra":
		_atual = Masmorra.new()
	else:
		_atual = Vila.new()
	add_child(_atual)
