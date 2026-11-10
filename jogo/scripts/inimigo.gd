extends CharacterBody2D
## Inimigos: "slime" (persegue), "arqueiro" (mantem distancia e atira), "chefe".

signal morto(posicao: Vector2, tipo: String)

const Arte = preload("res://scripts/arte.gd")
const Projetil = preload("res://scripts/projetil.gd")
const Jogador = preload("res://scripts/jogador.gd")

var tipo := "slime"
var vida := 3
var velocidade := 45.0
var raio := 6.0

var _recarga := 1.0
var _fase := 0.0
var _surgindo := 0.8
var _piscar := 0.0
var _morto := false
var _visual: Node2D


func configurar(t: String, nivel: int) -> void:
	tipo = t
	match tipo:
		"arqueiro":
			vida = 2 + nivel
			velocidade = 40.0
		"chefe":
			vida = 50 + nivel * 8
			velocidade = 28.0
			raio = 14.0
		_:
			vida = 3 + nivel
			velocidade = 45.0 + nivel * 4.0


func _ready() -> void:
	add_to_group("inimigos")
	collision_layer = 4
	collision_mask = 1
	motion_mode = CharacterBody2D.MOTION_MODE_FLOATING

	var forma := CollisionShape2D.new()
	var c := CircleShape2D.new()
	c.radius = raio
	forma.shape = c
	add_child(forma)

	var cor := Color(0.4, 0.9, 0.4)
	if tipo == "arqueiro":
		cor = Color(0.9, 0.6, 0.2)
	elif tipo == "chefe":
		cor = Color(0.6, 0.2, 0.8)
	_visual = Arte.visual(tipo, cor, Vector2(raio, raio) * 2.6)
	add_child(_visual)
	_recarga = randf_range(0.8, 1.8)


func _physics_process(delta: float) -> void:
	if _surgindo > 0.0:
		_surgindo -= delta
		_visual.modulate = Color(1, 1, 1, 0.35)
		return

	var jog := get_tree().get_first_node_in_group("jogador") as Jogador
	if jog == null or jog.vida <= 0:
		velocity = Vector2.ZERO
		return

	var para := jog.global_position - global_position
	var dist := para.length()
	var dir := para.normalized()

	match tipo:
		"arqueiro":
			if dist < 80.0:
				velocity = -dir * velocidade
			elif dist > 150.0:
				velocity = dir * velocidade
			else:
				velocity = dir.orthogonal() * velocidade * 0.6
			_recarga -= delta
			if _recarga <= 0.0:
				_recarga = 1.8
				_atirar(dir, 120.0)
		"chefe":
			velocity = dir * velocidade
			_recarga -= delta
			if _recarga <= 0.0:
				_recarga = 2.0
				for i in 12:
					_atirar(Vector2.RIGHT.rotated(_fase + TAU * i / 12.0), 90.0)
				_fase += 0.26
		_:
			velocity = dir * velocidade
	move_and_slide()

	if dist < raio + 8.0:
		jog.receber_dano(1)

	if _piscar > 0.0:
		_piscar -= delta
		_visual.modulate = Color(1, 0.4, 0.4)
	else:
		_visual.modulate = Color.WHITE
	if absf(velocity.x) > 1.0:
		_visual.scale.x = absf(_visual.scale.x) * (1.0 if velocity.x > 0.0 else -1.0)


func receber_dano(qtd: int) -> void:
	if _morto or _surgindo > 0.0:
		return
	vida -= qtd
	_piscar = 0.08
	if vida <= 0:
		_morto = true
		remove_from_group("inimigos")
		morto.emit(global_position, tipo)
		queue_free()


func _atirar(dir: Vector2, vel: float) -> void:
	var p := Projetil.new()
	p.configurar(global_position + dir * (raio + 2.0), dir, vel, 1, false)
	var cont := get_tree().get_first_node_in_group("container_projeteis")
	if cont == null:
		cont = get_parent()
	cont.add_child(p)
