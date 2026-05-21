#!/usr/bin/env python3
import aws_cdk as cdk
from riyalai.riyalai_stack import RiyalAiStack

app = cdk.App()
RiyalAiStack(app, "riyalai")
app.synth()
