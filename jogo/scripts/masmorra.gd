extends Node2D
## Masmorra: sequência de salas. Limpe a sala para a porta abrir.
## A última sala tem o chefe. Cada sala começa com um d20 do Mestre.

const Arte = preload("res://scripts/arte.gd")
const Jogador = preload("res://scripts/jogador.gd")
const Inimigo = preload("res://scripts/inimigo.gd")
const Coleta = preload("res://scripts/coleta.gd")
const Hud = preload("res://scripts/hud.gd")

const TILE := 16
const TOTAL_SALAS := 5
const DESCRICOES := [
	"O Mestre folheia o livro: 'Uma sala úmida. Algo se mexe nas sombras.'",
	"'Cheiro de mofo e de slime. Muito slime.'",
	"'Tochas tremulam. Você ouve passos... e não são os seus.'",
	"'Ossos pelo chão. Alguém não rolou bem os dados aqui.'",
	"'Uma sala estranhamente limpa. Isso nunca é bom sinal.'",
]

var sala := 0
var ouro_run := 0
var sementes_run := 0

var _jogador: Jogador
var _hud: Hud
var _sala_no: Node2D = null
var _area := Rect2()
var _vivos := 0
var _porta_usada := false
var _terminou := false


func _ready() -> void:
	_jogador = Jogador.new()
	add_child(_jogador)
	_jogador.morreu.connect(_ao_morrer)
	_hud = Hud.new()
	add_child(_hud)
	_proxima_sala()


func _process(_delta: float) -> void:
	_hud.extra = "Sala %d/%d   Achado: %d ouro, %d sementes" % [
		sala, TOTAL_SALAS, ouro_run, sementes_run
	]


func _proxima_sala() -> void:
	sala += 1
	_vivos = 0
	_porta_usada = false
	if _sala_no != null:
		_sala_no.remove_from_group("container_projeteis")
		_sala_no.queue_free()
	_sala_no = Node2D.new()
	_sala_no.add_to_group("container_projeteis")
	add_child(_sala_no)

	var e_chefe := sala == TOTAL_SALAS
	var colunas := 26 if e_chefe else randi_range(18, 24)
	var linhas := 18 if e_chefe else randi_range(12, 15)
	_area = Rect2(0, 0, colunas * TILE, linhas * TILE)
	_sala_no.add_child(Arte.chao("chao_masmorra", Color(0.22, 0.2, 0.26),
		Color(0.26, 0.24, 0.3), _area.size))
	_criar_paredes(not e_chefe)

	_jogador.global_position = Vector2(_area.size.x / 2.0, _area.size.y - 32.0)
	_jogador.camera.reset_smoothing()

	if e_chefe:
		Narrador.falar("O Mestre baixa a voz: 'O chão treme. O CHEFE desta masmorra acordou.'")
		_spawn("chefe")
		_spawn("slime")
		_spawn("slime")
		return

	Narrador.falar(DESCRICOES.pick_random())
	var qtd := 2 + sala
	var dado: int = Narrador.rolar_d20("Evento da sala %d" % sala)
	if dado <= 3:
		qtd += 3
		Narrador.falar("Emboscada! Mais inimigos saem das paredes.")
	elif dado == 20:
		ouro_run += 25
		Narrador.falar("Um baú esquecido no canto: +25 de ouro.")
	elif dado >= 17:
		_jogador.curar(2)
		Narrador.falar("Uma fonte de água limpa. Você recupera 2 de vida.")
	for i in qtd:
		var tipos := ["slime"] if sala == 1 else ["slime", "slime", "arqueiro"]
		_spawn(tipos.pick_random())


func _criar_paredes(com_pilares: bool) -> void:
	var w := _area.size.x
	var h := _area.size.y
	var t := float(TILE)
	var cor_a := Color(0.38, 0.33, 0.44)
	var cor_b := Color(0.33, 0.29, 0.39)
	for r in [
		Rect2(-t, -t, w + 2 * t, t),
		Rect2(-t, h, w + 2 * t, t),
		Rect2(-t, 0, t, h),
		Rect2(w, 0, t, h),
	]:
		_sala_no.add_child(Arte.bloco(r, "parede_masmorra", cor_a, cor_b))
	if not com_pilares:
		return
	var inicio := Vector2(w / 2.0, h - 32.0)
	for i in randi_range(2, 4):
		var p := Vector2(randf_range(40.0, w - 56.0), randf_range(40.0, h - 80.0))
		if p.distance_to(inicio) < 70.0:
			continue
		_sala_no.add_child(Arte.bloco(Rect2(p, Vector2(t, t)), "pilar", cor_a, cor_b))


func _spawn(tipo: String) -> void:
	var ini := Inimigo.new()
	ini.configurar(tipo, sala)
	ini.position = _posicao_livre()
	ini.morto.connect(_ao_inimigo_morrer)
	_sala_no.add_child(ini)
	_vivos += 1


func _posicao_livre() -> Vector2:
	var p := Vector2.ZERO
	for i in 20:
		p = Vector2(randf_range(32.0, _area.size.x - 32.0), randf_range(32.0, _area.size.y - 64.0))
		if p.distance_to(_jogador.global_position) > 100.0:
			break
	return p


func _ao_inimigo_morrer(pos: Vector2, tipo: String) -> void:
	_vivos -= 1
	Jogo.registrar(tipo)
	# Chamado durante a física: criar nós só no fim do frame.
	_soltar_loot.call_deferred(pos, tipo)
	if _vivos <= 0 and not _terminou:
		_sala_limpa.call_deferred()


func _soltar_loot(pos: Vector2, tipo: String) -> void:
	var moedas := 1 + randi() % 2
	var sementes := 1 if randf() < 0.2 else 0
	if tipo == "arqueiro":
		moedas += 1
	elif tipo == "chefe":
		moedas = 15
		sementes = 3
	for i in moedas:
		_criar_coleta("moeda", 2, pos)
	for i in sementes:
		_criar_coleta("semente", 1, pos)


func _criar_coleta(tipo: String, valor: int, pos: Vector2) -> void:
	var c := Coleta.new()
	c.tipo = tipo
	c.valor = valor
	c.position = pos + Vector2(randf_range(-10.0, 10.0), randf_range(-10.0, 10.0))
	c.coletado.connect(_ao_coletar)
	_sala_no.add_child(c)


func _ao_coletar(tipo: String, valor: int) -> void:
	if tipo == "moeda":
		ouro_run += valor
	else:
		sementes_run += valor


func _sala_limpa() -> void:
	if sala >= TOTAL_SALAS:
		Narrador.falar("O chefe cai! O Mestre aplaude devagar. Uma escada leva à superfície.")
	else:
		Narrador.falar("Silêncio. Uma porta se abre ao norte.")
	var porta := Area2D.new()
	porta.collision_layer = 0
	porta.collision_mask = 2
	porta.position = Vector2(_area.size.x / 2.0, 14.0)
	var forma := CollisionShape2D.new()
	var r := RectangleShape2D.new()
	r.size = Vector2(24, 16)
	forma.shape = r
	porta.add_child(forma)
	porta.add_child(Arte.visual("porta", Color(0.9, 0.8, 0.3), Vector2(24, 20)))
	porta.body_entered.connect(_ao_tocar_porta)
	_sala_no.add_child(porta)


func _ao_tocar_porta(_corpo: Node2D) -> void:
	if _porta_usada or _terminou:
		return
	_porta_usada = true
	if sala >= TOTAL_SALAS:
		_vitoria.call_deferred()
	else:
		_proxima_sala.call_deferred()


func _vitoria() -> void:
	_terminou = true
	var bonus := 20
	Jogo.ouro += ouro_run + bonus
	Jogo.sementes += sementes_run
	Jogo.passar_dia()
	Narrador.falar("Vitória! Você leva %d de ouro e %d sementes para casa." % [
		ouro_run + bonus, sementes_run
	])
	Jogo.ir_para("vila")


func _ao_morrer() -> void:
	if _terminou:
		return
	_terminou = true
	var perdido := int(ouro_run / 2.0)
	Jogo.ouro += ouro_run - perdido
	Jogo.sementes += sementes_run
	Jogo.passar_dia()
	_jogador.visible = false
	_jogador.set_physics_process(false)
	Narrador.falar("Seu herói cai. O Mestre suspira: 'Tá, você acorda na vila. Mas o ouro...'")
	Narrador.falar("Você perdeu %d de ouro na fuga." % perdido)
	get_tree().create_timer(2.5).timeout.connect(_voltar_vila)


func _voltar_vila() -> void:
	Jogo.ir_para("vila")
