extends Node2D
## Escolha de classe (primeira vez) e troca entre a vila e a masmorra.

const Arte = preload("res://scripts/arte.gd")
const Vila = preload("res://scripts/vila.gd")
const Masmorra = preload("res://scripts/masmorra.gd")

var _atual: Node = null


func _ready() -> void:
	Jogo.pedir_cena.connect(_trocar, CONNECT_DEFERRED)
	if Jogo.classe == "":
		_escolher_classe()
	else:
		_comecar()


func _comecar() -> void:
	_trocar("vila")
	if Jogo.primeira_vez:
		Narrador.falar("O Mestre ajeita os óculos e rola os dados atrás do escudo...")
		Narrador.falar("'Você herdou uma fazenda caindo aos pedaços. "
			+ "E uma masmorra no quintal. Parabéns.'")
		Narrador.falar("'Plante, regue, durma. E desça a masmorra para pagar as sementes.'")
		Narrador.falar("'Ah, e o quadro de missões fica perto da caixa de venda.'")
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


func _escolher_classe() -> void:
	var camada := CanvasLayer.new()
	camada.layer = 15
	add_child(camada)

	var centro := CenterContainer.new()
	centro.set_anchors_preset(Control.PRESET_FULL_RECT)
	camada.add_child(centro)

	var painel := PanelContainer.new()
	painel.add_theme_stylebox_override("panel", Arte.estilo_painel())
	centro.add_child(painel)

	var caixa := VBoxContainer.new()
	caixa.add_theme_constant_override("separation", 6)
	painel.add_child(caixa)

	var titulo := Label.new()
	titulo.text = "O Mestre pega uma ficha em branco: 'Quem é você?'"
	titulo.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	titulo.add_theme_font_size_override("font_size", 13)
	caixa.add_child(titulo)

	var primeiro: Button = null
	for id in Jogo.CLASSES:
		var info: Dictionary = Jogo.CLASSES[id]
		var b := Button.new()
		b.text = "%s\n%s" % [info["nome"], info["desc"]]
		b.custom_minimum_size = Vector2(340, 40)
		b.add_theme_font_size_override("font_size", 11)
		b.pressed.connect(_classe_escolhida.bind(id, camada))
		caixa.add_child(b)
		if primeiro == null:
			primeiro = b
	if primeiro != null:
		primeiro.grab_focus()


func _classe_escolhida(id: String, camada: CanvasLayer) -> void:
	Jogo.classe = id
	Jogo.salvar()
	camada.queue_free()
	var nome: String = Jogo.CLASSES[id]["nome"]
	Narrador.falar("'%s, é? O Mestre anota na ficha. Boa escolha... talvez.'" % nome)
	_comecar()
