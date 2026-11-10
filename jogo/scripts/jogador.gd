extends CharacterBody2D
## Heroi. Mira sozinho no inimigo mais proximo (estilo Soul Knight).

signal morreu

const Arte = preload("res://scripts/arte.gd")
const Projetil = preload("res://scripts/projetil.gd")

const VELOCIDADE := 110.0
const VELOCIDADE_DASH := 330.0
const TEMPO_DASH := 0.15
const RECARGA_DASH := 0.8
const ALCANCE_MIRA := 220.0

var vida := 6
var vida_max := 6
var pode_atacar := true
var camera: Camera2D

var _mira := Vector2.RIGHT
var _recarga_tiro := 0.0
var _tempo_dash := 0.0
var _recarga_dash := 0.0
var _dir_dash := Vector2.ZERO
var _invencivel := 0.0
var _visual: Node2D


func _ready() -> void:
	add_to_group("jogador")
	collision_layer = 2
	collision_mask = 1
	motion_mode = CharacterBody2D.MOTION_MODE_FLOATING

	var forma := CollisionShape2D.new()
	var circulo := CircleShape2D.new()
	circulo.radius = 6.0
	forma.shape = circulo
	add_child(forma)

	_visual = Arte.visual("jogador", Color(0.3, 0.6, 1.0), Vector2(14, 18))
	add_child(_visual)

	vida_max = Jogo.vida_max
	vida = vida_max

	camera = Camera2D.new()
	camera.zoom = Vector2(1.5, 1.5)
	camera.position_smoothing_enabled = true
	camera.position_smoothing_speed = 8.0
	add_child(camera)
	camera.make_current()


func _physics_process(delta: float) -> void:
	_recarga_tiro -= delta
	_recarga_dash -= delta
	_invencivel -= delta

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

	if pode_atacar and Input.is_action_pressed("atacar") and _recarga_tiro <= 0.0:
		_atirar()

	var piscando := _invencivel > 0.0 and _tempo_dash <= 0.0
	_visual.modulate.a = 0.5 if piscando else 1.0


func receber_dano(qtd: int) -> void:
	if _invencivel > 0.0 or vida <= 0:
		return
	vida -= qtd
	_invencivel = 0.8
	if vida <= 0:
		morreu.emit()


func curar(qtd: int) -> void:
	vida = mini(vida + qtd, vida_max)


func _atirar() -> void:
	var nivel: int = Jogo.nivel_arma
	_recarga_tiro = maxf(0.12, 0.34 - 0.04 * nivel)
	var angulos := [0.0]
	if nivel >= 3:
		angulos = [-0.15, 0.0, 0.15]
	for ang in angulos:
		var p := Projetil.new()
		p.configurar(global_position + _mira * 8.0, _mira.rotated(ang), 260.0, nivel, true)
		_container().add_child(p)


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
