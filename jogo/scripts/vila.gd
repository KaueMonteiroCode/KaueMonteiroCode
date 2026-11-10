extends Node2D
## Vila: fazenda (plantar, regar, colher), loja, caixa de venda, casa e entrada da masmorra.

const Arte = preload("res://scripts/arte.gd")
const Jogador = preload("res://scripts/jogador.gd")
const Hud = preload("res://scripts/hud.gd")

const LARGURA := 480.0
const ALTURA := 320.0

var _jogador: Jogador
var _hud: Hud
var _interativos: Array = []
var _canteiros_vis: Array = []
var _loja: CanvasLayer = null
var _botoes_loja := {}
var _saindo := false


func _ready() -> void:
	y_sort_enabled = true
	add_child(Arte.chao("chao_vila", Color(0.36, 0.6, 0.3), Color(0.33, 0.56, 0.28),
		Vector2(LARGURA, ALTURA)))
	_criar_bordas()

	_predio("casa", Color(0.7, 0.45, 0.3), Vector2(56, 48), Vector2(70, 60),
		"Dormir (passa o dia)", _dormir)
	_predio("loja", Color(0.45, 0.45, 0.75), Vector2(56, 48), Vector2(410, 60),
		"Loja", _abrir_loja)
	_predio("caixa_venda", Color(0.6, 0.4, 0.2), Vector2(20, 16), Vector2(240, 70),
		"Vender colheitas", _vender)
	_predio("portal_masmorra", Color(0.25, 0.1, 0.35), Vector2(32, 32), Vector2(420, 262),
		"Entrar na masmorra", _entrar_masmorra, false)

	for pos in [Vector2(30, 180), Vector2(60, 290), Vector2(150, 285), Vector2(330, 290)]:
		_predio("arvore", Color(0.15, 0.4, 0.15), Vector2(24, 32), pos, "", Callable())

	_criar_canteiros()

	_jogador = Jogador.new()
	_jogador.pode_atacar = false
	_jogador.position = Vector2(240, 230)
	add_child(_jogador)

	_hud = Hud.new()
	add_child(_hud)

	if Jogo.manha_pendente:
		_amanhecer()


func _process(_delta: float) -> void:
	if _loja != null:
		_hud.dica = ""
		if Input.is_action_just_pressed("ui_cancel"):
			_fechar_loja()
		return

	var melhor = null
	var melhor_dist := INF
	for item in _interativos:
		var d := _jogador.global_position.distance_to(item["pos"])
		if d < item["raio"] and d < melhor_dist:
			melhor_dist = d
			melhor = item
	if melhor == null:
		_hud.dica = ""
		return

	var dica = melhor["dica"]
	_hud.dica = dica.call() if dica is Callable else str(dica)
	if Input.is_action_just_pressed("interagir"):
		var acao: Callable = melhor["acao"]
		acao.call()


# --- Montagem do cenario ---------------------------------------------

func _criar_bordas() -> void:
	var t := 16.0
	var cor_a := Color(0.55, 0.4, 0.25)
	var cor_b := Color(0.5, 0.36, 0.22)
	for r in [
		Rect2(-t, -t, LARGURA + 2 * t, t),
		Rect2(-t, ALTURA, LARGURA + 2 * t, t),
		Rect2(-t, 0, t, ALTURA),
		Rect2(LARGURA, 0, t, ALTURA),
	]:
		add_child(Arte.bloco(r, "cerca", cor_a, cor_b))


func _predio(nome: String, cor: Color, tamanho: Vector2, centro: Vector2,
		dica: String, acao: Callable, solido := true) -> void:
	var corpo: Node2D
	if solido:
		var estatico := StaticBody2D.new()
		estatico.collision_layer = 1
		estatico.collision_mask = 0
		var forma := CollisionShape2D.new()
		var r := RectangleShape2D.new()
		r.size = tamanho * Vector2(1.0, 0.5)
		forma.shape = r
		forma.position = Vector2(0, tamanho.y * 0.25)
		estatico.add_child(forma)
		corpo = estatico
	else:
		corpo = Node2D.new()
	corpo.position = centro
	corpo.add_child(Arte.visual(nome, cor, tamanho))
	if not Arte.tem(nome) and dica != "":
		var rotulo := Label.new()
		rotulo.text = nome.capitalize()
		rotulo.add_theme_font_size_override("font_size", 8)
		rotulo.position = Vector2(-tamanho.x / 2.0, -tamanho.y / 2.0 - 12.0)
		corpo.add_child(rotulo)
	add_child(corpo)
	if acao.is_valid():
		var ponto := centro + Vector2(0, tamanho.y / 2.0 + 8.0)
		if not solido:
			ponto = centro
		_interativos.append({"pos": ponto, "raio": 26.0, "dica": dica, "acao": acao})


func _criar_canteiros() -> void:
	for i in Jogo.NUM_CANTEIROS:
		var no := Node2D.new()
		no.z_index = -1
		no.position = Vector2(195 + (i % 4) * 30, 150 + int(i / 4) * 30)
		add_child(no)
		_canteiros_vis.append(no)
		_interativos.append({
			"pos": no.position,
			"raio": 15.0,
			"dica": _dica_canteiro.bind(i),
			"acao": _usar_canteiro.bind(i),
		})
		_atualizar_canteiro(i)


# --- Fazenda ---------------------------------------------------------

func _dica_canteiro(i: int) -> String:
	var c: Dictionary = Jogo.canteiros[i]
	if not c["plantado"]:
		if Jogo.sementes > 0:
			return "Plantar semente (%d)" % Jogo.sementes
		return "Sem sementes (compre na loja)"
	if Jogo.canteiro_pronto(i):
		return "Colher"
	if not c["regado"]:
		return "Regar"
	return "Crescendo... (%d/%d dias)" % [c["dias"], Jogo.DIAS_PARA_CRESCER]


func _usar_canteiro(i: int) -> void:
	var c: Dictionary = Jogo.canteiros[i]
	if not c["plantado"]:
		if Jogo.sementes <= 0:
			Narrador.falar("O Mestre: 'Plantar o quê? Ar? Compre sementes.'")
			return
		Jogo.sementes -= 1
		c["plantado"] = true
		c["regado"] = false
		c["dias"] = 0
		Narrador.falar("Você planta uma semente. Regue todo dia para ela crescer.")
	elif Jogo.canteiro_pronto(i):
		c["plantado"] = false
		c["regado"] = false
		c["dias"] = 0
		Jogo.colheitas += 1
		Narrador.falar("Colheita! O Mestre anota no caderno: +1 colheita.")
	elif not c["regado"]:
		c["regado"] = true
	_atualizar_canteiro(i)
	Jogo.salvar()


func _atualizar_canteiro(i: int) -> void:
	var no: Node2D = _canteiros_vis[i]
	for filho in no.get_children():
		filho.queue_free()
	var c: Dictionary = Jogo.canteiros[i]
	if c["regado"]:
		no.add_child(Arte.visual("canteiro_molhado", Color(0.3, 0.2, 0.12), Vector2(20, 20)))
	else:
		no.add_child(Arte.visual("canteiro", Color(0.5, 0.35, 0.2), Vector2(20, 20)))
	if Jogo.canteiro_pronto(i):
		no.add_child(Arte.visual("planta_pronta", Color(1, 0.75, 0.2), Vector2(14, 16)))
	elif c["plantado"]:
		no.add_child(Arte.visual("broto", Color(0.4, 0.85, 0.3), Vector2(8, 8)))


## Evento da manhã, decidido no d20 (estilo mesa de RPG).
func _amanhecer() -> void:
	Jogo.manha_pendente = false
	var dado: int = Narrador.rolar_d20("Clima da manhã")
	if dado >= 17:
		Narrador.falar("Choveu à noite! Todas as plantas já estão regadas.")
		for c in Jogo.canteiros:
			if c["plantado"]:
				c["regado"] = true
	elif dado == 1:
		var plantados := []
		for i in Jogo.NUM_CANTEIROS:
			if Jogo.canteiros[i]["plantado"] and not Jogo.canteiro_pronto(i):
				plantados.append(i)
		if not plantados.is_empty():
			var alvo: int = plantados.pick_random()
			Jogo.canteiros[alvo] = {"plantado": false, "regado": false, "dias": 0}
			Narrador.falar("Corvos! Um broto foi devorado. O Mestre dá de ombros.")
	for i in Jogo.NUM_CANTEIROS:
		_atualizar_canteiro(i)
	Jogo.salvar()


# --- Prédios ---------------------------------------------------------

func _dormir() -> void:
	Jogo.passar_dia()
	Narrador.falar("O Mestre vira a página. Dia %d." % Jogo.dia)
	_amanhecer()


func _vender() -> void:
	if Jogo.colheitas <= 0:
		Narrador.falar("A caixa de venda ecoa vazia. O Mestre ri baixinho.")
		return
	var ganho: int = Jogo.colheitas * Jogo.PRECO_COLHEITA
	Narrador.falar("Você vende %d colheitas por %d de ouro." % [Jogo.colheitas, ganho])
	Jogo.ouro += ganho
	Jogo.colheitas = 0
	Jogo.salvar()


func _entrar_masmorra() -> void:
	if _saindo:
		return
	_saindo = true
	Jogo.salvar()
	Narrador.falar("Você desce os degraus úmidos. O Mestre sorri de um jeito preocupante.")
	Jogo.ir_para("masmorra")


# --- Loja ------------------------------------------------------------

func _abrir_loja() -> void:
	if _loja != null:
		return
	_loja = CanvasLayer.new()
	_loja.layer = 15
	add_child(_loja)

	var centro := CenterContainer.new()
	centro.set_anchors_preset(Control.PRESET_FULL_RECT)
	centro.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_loja.add_child(centro)

	var painel := PanelContainer.new()
	var estilo := StyleBoxFlat.new()
	estilo.bg_color = Color(0.15, 0.12, 0.18, 0.95)
	estilo.border_color = Color(0.8, 0.65, 0.3)
	estilo.set_border_width_all(2)
	estilo.set_corner_radius_all(4)
	estilo.set_content_margin_all(8)
	painel.add_theme_stylebox_override("panel", estilo)
	centro.add_child(painel)

	var caixa := VBoxContainer.new()
	caixa.add_theme_constant_override("separation", 4)
	painel.add_child(caixa)

	var titulo := Label.new()
	titulo.text = "Loja do Mercador"
	titulo.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	titulo.add_theme_font_size_override("font_size", 13)
	caixa.add_child(titulo)

	_botao(caixa, "semente1", _comprar_semente.bind(1))
	_botao(caixa, "semente5", _comprar_semente.bind(5))
	_botao(caixa, "arma", _melhorar_arma)
	_botao(caixa, "vida", _melhorar_vida)
	_botao(caixa, "fechar", _fechar_loja)
	_atualizar_loja()


func _botao(pai: Node, chave: String, acao: Callable) -> void:
	var b := Button.new()
	b.custom_minimum_size = Vector2(230, 26)
	b.focus_mode = Control.FOCUS_NONE
	b.add_theme_font_size_override("font_size", 12)
	b.pressed.connect(acao)
	pai.add_child(b)
	_botoes_loja[chave] = b


func _atualizar_loja() -> void:
	if _loja == null:
		return
	var s1: Button = _botoes_loja["semente1"]
	var s5: Button = _botoes_loja["semente5"]
	var arma: Button = _botoes_loja["arma"]
	var vida: Button = _botoes_loja["vida"]
	var fechar: Button = _botoes_loja["fechar"]
	s1.text = "1 semente  (%d ouro)" % Jogo.PRECO_SEMENTE
	s5.text = "5 sementes  (%d ouro)" % (Jogo.PRECO_SEMENTE * 5)
	if Jogo.nivel_arma >= Jogo.NIVEL_ARMA_MAX:
		arma.text = "Arma no nível máximo"
		arma.disabled = true
	else:
		arma.text = "Melhorar arma nv %d  (%d ouro)" % [Jogo.nivel_arma + 1, Jogo.custo_arma()]
	if Jogo.vida_max >= Jogo.VIDA_MAX_LIMITE:
		vida.text = "Vida no máximo"
		vida.disabled = true
	else:
		vida.text = "+1 de vida máxima  (%d ouro)" % Jogo.custo_vida()
	fechar.text = "Fechar"


func _pagar(custo: int) -> bool:
	if Jogo.ouro < custo:
		Narrador.falar("O mercador cruza os braços: 'Sem ouro, sem negócio.'")
		return false
	Jogo.ouro -= custo
	return true


func _comprar_semente(qtd: int) -> void:
	if _pagar(Jogo.PRECO_SEMENTE * qtd):
		Jogo.sementes += qtd
		Jogo.salvar()
	_atualizar_loja()


func _melhorar_arma() -> void:
	if Jogo.nivel_arma < Jogo.NIVEL_ARMA_MAX and _pagar(Jogo.custo_arma()):
		Jogo.nivel_arma += 1
		Narrador.falar("Sua arma brilha. Nível %d!" % Jogo.nivel_arma)
		Jogo.salvar()
	_atualizar_loja()


func _melhorar_vida() -> void:
	if Jogo.vida_max < Jogo.VIDA_MAX_LIMITE and _pagar(Jogo.custo_vida()):
		Jogo.vida_max += 1
		_jogador.vida_max = Jogo.vida_max
		_jogador.vida = Jogo.vida_max
		Narrador.falar("Você se sente mais forte. Vida máxima: %d." % Jogo.vida_max)
		Jogo.salvar()
	_atualizar_loja()


func _fechar_loja() -> void:
	if _loja != null:
		_loja.queue_free()
	_loja = null
	_botoes_loja.clear()
