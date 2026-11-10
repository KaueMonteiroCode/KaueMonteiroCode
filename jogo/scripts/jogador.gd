extends CharacterBody2D
## Herói. Mira sozinho no inimigo mais próximo (estilo Soul Knight).
## Classes: "cavaleiro", "mago", "ranger". Cada uma atira diferente e tem uma habilidade.

signal morreu

const Arte = preload("res://scripts/arte.gd")
const Projetil = preload("res://scripts/projetil.gd")

const VELOCIDADE := 110.0
const VELOCIDADE_DASH := 330.0
const TEMPO_DASH := 0.15
const RECARGA_DASH := 0.8
const RECARGA_HABILIDADE := 8.0
const ALCANCE_MIRA := 220.0
const CORES := {
	"cavaleiro": Color(0.75, 0.75, 0.85),
	"mago": Color(0.6, 0.35, 0.95),
	"ranger": Color(0.3, 0.75, 0.4),
}

var vida := 6
var vida_max := 6
var pode_atacar := true
var classe := "ranger"
var recarga_habilidade := 0.0
var camera: Camera2D

var _mira := Vector2.RIGHT
var _recarga_tiro := 0.0
var _tempo_dash := 0.0
var _recarga_dash := 0.0
var _dir_dash := Vector2.ZERO
var _invencivel := 0.0
var _escudo := 0.0
var _rajada := 0.0
var _tremor := 0.0
var _visual: Node2D
var _area_camera := Rect2()


func _ready() -> void:
	add_to_group("jogador")
	collision_layer = 2
	collision_mask = 1
	motion_mode = CharacterBody2D.MOTION_MODE_FLOATING

	if Jogo.classe != "":
		classe = Jogo.classe

	var forma := CollisionShape2D.new()
	var circulo := CircleShape2D.new()
	circulo.radius = 6.0
	forma.shape = circulo
	add_child(forma)

	var nome := "jogador_" + classe
	if not Arte.tem(nome):
		nome = "jogador"
	var cor: Color = CORES.get(classe, Color(0.3, 0.6, 1.0))
	_visual = Arte.visual(nome, cor, Vector2(14, 18))
	add_child(_visual)

	vida_max = Jogo.vida_total()
	vida = vida_max

	camera = Camera2D.new()
	camera.zoom = Vector2(1.5, 1.5)
	camera.position_smoothing_enabled = true
	camera.position_smoothing_speed = 8.0
	add_child(camera)
	camera.make_current()
	get_viewport().size_changed.connect(_aplicar_limites)


func _physics_process(delta: float) -> void:
	_recarga_tiro -= delta
	_recarga_dash -= delta
	_invencivel -= delta
	_escudo -= delta
	_rajada -= delta
	recarga_habilidade = maxf(recarga_habilidade - delta, 0.0)

	var entrada := Input.get_vector("mover_esquerda", "mover_direita", "mover_cima", "mover_baixo")
	if _tempo_dash > 0.0:
		_tempo_dash -= delta
		velocity = _dir_dash * VELOCIDADE_DASH
	else:
		velocity = entrada * VELOCIDADE
		if Input.is_action_just_pressed("dash") and _recarga_dash <= 0.0:
			_dir_dash = (entrada if entrada != Vector2.ZERO else _mira).normalized()
			_tempo_dash = TEMPO_DASH
			_recarga_dash = RECARGA_DASH
			_invencivel = maxf(_invencivel, TEMPO_DASH + 0.05)
	move_and_slide()

	if entrada != Vector2.ZERO:
		_mira = entrada.normalized()
	var alvo := _inimigo_mais_proximo()
	if alvo != null:
		_mira = (alvo.global_position - global_position).normalized()
	if absf(_mira.x) > 0.1:
		_visual.scale.x = absf(_visual.scale.x) * (1.0 if _mira.x > 0.0 else -1.0)

	if pode_atacar:
		if Input.is_action_pressed("atacar") and _recarga_tiro <= 0.0:
			_atirar()
		if Input.is_action_just_pressed("habilidade") and recarga_habilidade <= 0.0:
			_usar_habilidade()

	_atualizar_efeitos(delta)


func receber_dano(qtd: int) -> void:
	if _invencivel > 0.0 or vida <= 0:
		return
	vida -= qtd
	_invencivel = 0.8
	_tremor = 0.25
	Arte.texto_flutuante(get_parent(), global_position + Vector2(0, -14), "-%d" % qtd,
		Color(1, 0.35, 0.35))
	if vida <= 0:
		morreu.emit()


## Impede a câmera de mostrar o vazio fora do mapa.
## Se o mapa for menor que a tela num eixo, a câmera fica centralizada nele.
func limitar_camera(area: Rect2) -> void:
	_area_camera = area
	_aplicar_limites()
	camera.reset_smoothing()


func _aplicar_limites() -> void:
	if _area_camera.size == Vector2.ZERO:
		return
	var tela := get_viewport_rect().size / camera.zoom
	var centro := _area_camera.get_center()
	var a := _area_camera
	if a.size.x < tela.x:
		a.position.x = centro.x - tela.x / 2.0
		a.size.x = tela.x
	if a.size.y < tela.y:
		a.position.y = centro.y - tela.y / 2.0
		a.size.y = tela.y
	camera.limit_left = floori(a.position.x)
	camera.limit_top = floori(a.position.y)
	camera.limit_right = ceili(a.end.x)
	camera.limit_bottom = ceili(a.end.y)


func curar(qtd: int) -> void:
	vida = mini(vida + qtd, vida_max)


func _atualizar_efeitos(delta: float) -> void:
	if _escudo > 0.0:
		_visual.modulate = Color(0.6, 0.85, 1.0)
	elif _invencivel > 0.0 and _tempo_dash <= 0.0:
		_visual.modulate = Color(1, 1, 1, 0.5)
	else:
		_visual.modulate = Color.WHITE
	if _tremor > 0.0:
		_tremor -= delta
		camera.offset = Vector2(randf_range(-3.0, 3.0), randf_range(-3.0, 3.0))
	else:
		camera.offset = Vector2.ZERO


# --- Ataques ---------------------------------------------------------

func _atirar() -> void:
	var nivel: int = Jogo.nivel_arma
	match classe:
		"cavaleiro":
			_recarga_tiro = maxf(0.25, 0.5 - 0.04 * nivel)
			var angulos := [-0.25, 0.0, 0.25]
			if nivel >= 3:
				angulos = [-0.36, -0.12, 0.12, 0.36]
			for ang in angulos:
				_disparar(ang, 220.0, nivel + 1, 0.35, false, 3.0)
		"mago":
			_recarga_tiro = maxf(0.35, 0.6 - 0.05 * nivel)
			_disparar(0.0, 140.0, nivel + 2, 2.0, true, 5.0)
			if nivel >= 3:
				_disparar(-0.25, 140.0, nivel, 2.0, true, 4.0)
				_disparar(0.25, 140.0, nivel, 2.0, true, 4.0)
		_:
			var recarga := maxf(0.12, 0.3 - 0.035 * nivel)
			if _rajada > 0.0:
				recarga *= 0.35
			_recarga_tiro = recarga
			var angulos := [0.0]
			if nivel >= 3:
				angulos = [-0.12, 0.0, 0.12]
			for ang in angulos:
				_disparar(ang, 300.0, nivel, 1.2, false, 2.5)


func _disparar(ang: float, vel: float, dano: int, duracao: float, perfura: bool,
		raio: float) -> void:
	var p := Projetil.new()
	p.configurar(global_position + _mira * 8.0, _mira.rotated(ang), vel, dano, true)
	p.duracao = duracao
	p.perfura = perfura
	p.raio = raio
	p.visual_nome = "tiro_" + classe
	_container().add_child(p)


func _usar_habilidade() -> void:
	recarga_habilidade = RECARGA_HABILIDADE
	var texto := ""
	match classe:
		"cavaleiro":
			_escudo = 2.5
			_invencivel = maxf(_invencivel, 2.5)
			texto = "ESCUDO!"
		"mago":
			var nivel: int = Jogo.nivel_arma
			for i in 16:
				_disparar(TAU * i / 16.0, 160.0, nivel + 2, 1.0, true, 4.0)
			texto = "EXPLOSÃO!"
		_:
			_rajada = 3.0
			texto = "RAJADA!"
	Arte.texto_flutuante(get_parent(), global_position + Vector2(0, -16), texto,
		Color(0.7, 0.9, 1.0))


func _container() -> Node:
	var c := get_tree().get_first_node_in_group("container_projeteis")
	return c if c != null else get_parent()


func _inimigo_mais_proximo() -> Node2D:
	var melhor: Node2D = null
	var melhor_dist := ALCANCE_MIRA
	for n in get_tree().get_nodes_in_group("inimigos"):
		var inimigo := n as Node2D
		if inimigo == null:
			continue
		var d := global_position.distance_to(inimigo.global_position)
		if d < melhor_dist:
			melhor_dist = d
			melhor = inimigo
	return melhor
