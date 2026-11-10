extends Area2D
## Tiro do jogador ou de inimigo.

const Arte = preload("res://scripts/arte.gd")

var direcao := Vector2.RIGHT
var velocidade := 200.0
var dano := 1
var do_jogador := true

var _vida := 2.0
var _usado := false


func configurar(pos: Vector2, dir: Vector2, vel: float, d: int, jogador: bool) -> void:
	position = pos
	direcao = dir.normalized()
	velocidade = vel
	dano = d
	do_jogador = jogador


func _ready() -> void:
	collision_layer = 0
	# paredes (1) + inimigos (4) ou jogador (2)
	collision_mask = 1 | (4 if do_jogador else 2)
	var forma := CollisionShape2D.new()
	var c := CircleShape2D.new()
	c.radius = 3.0
	forma.shape = c
	add_child(forma)
	var nome := "tiro_jogador" if do_jogador else "tiro_inimigo"
	var cor := Color(1, 0.9, 0.3) if do_jogador else Color(1, 0.3, 0.5)
	var vis := Arte.visual(nome, cor, Vector2(6, 6))
	vis.rotation = direcao.angle()
	add_child(vis)
	body_entered.connect(_ao_tocar)


func _physics_process(delta: float) -> void:
	position += direcao * velocidade * delta
	_vida -= delta
	if _vida <= 0.0:
		queue_free()


func _ao_tocar(corpo: Node2D) -> void:
	if _usado:
		return
	_usado = true
	if corpo.has_method("receber_dano"):
		corpo.call("receber_dano", dano)
	queue_free()
